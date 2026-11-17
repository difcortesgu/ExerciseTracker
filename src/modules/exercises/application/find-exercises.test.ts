import { domainError } from '@shared/domain/domain-error';
import {
  aBuiltInExercise,
  aCustomExercise,
  builtInVocabularyValues,
  aVocabularyValue,
  vocabularyKeyOf,
} from '@test/builders/exercise.builder';
import { InMemoryExerciseStore } from '@test/fakes/in-memory-exercise-store';
import { RecordingLogger } from '@test/fakes/recording-logger';
import { failedSeeding, seededLibrary } from '@test/fakes/stub-ensure-library-seeded';
import { unwrap, unwrapErr } from '@test/support/unwrap';

import { EMPTY_EXERCISE_QUERY } from '../domain/exercise-query';

import type { EnsureLibrarySeeded } from './ensure-library-seeded';
import { createFindExercises } from './find-exercises';

const squat = aBuiltInExercise().named('Barbell Squat').build();
const plank = aBuiltInExercise()
  .named('Plank')
  .with({ equipment: vocabularyKeyOf('body only') })
  .build();
const sandbag = aVocabularyValue().ofKind('equipment').labelled('Sandbag').custom().build();
const goblet = aCustomExercise().named('My Goblet Squat').with({ equipment: sandbag.key }).build();
const archived = aCustomExercise().named('Old Squat').archived().build();

function setUp(ensureLibrarySeeded: EnsureLibrarySeeded = seededLibrary()) {
  const store = new InMemoryExerciseStore({
    exercises: [squat, plank, goblet, archived],
    vocabulary: [...builtInVocabularyValues(), sandbag],
  });
  const logger = new RecordingLogger();
  const findExercises = createFindExercises({
    ensureLibrarySeeded,
    reader: store,
    vocabularyReader: store,
    logger,
  });
  return { store, logger, findExercises };
}

describe('createFindExercises (S1-15)', () => {
  it('returns every active exercise, sorted by name, when there is no query', async () => {
    const { findExercises } = setUp();

    const items = unwrap(await findExercises(EMPTY_EXERCISE_QUERY));

    expect(items.map(({ name }) => name)).toEqual(['Barbell Squat', 'My Goblet Squat', 'Plank']);
  });

  it('matches the search text with the domain rules (S1-09)', async () => {
    const { findExercises } = setUp();

    const items = unwrap(await findExercises({ ...EMPTY_EXERCISE_QUERY, text: 'SQU' }));

    expect(items.map(({ name }) => name)).toEqual(['Barbell Squat', 'My Goblet Squat']);
  });

  it('filters by a user-defined value like a built-in one (S1-29)', async () => {
    const { findExercises } = setUp();

    const items = unwrap(
      await findExercises({ ...EMPTY_EXERCISE_QUERY, equipment: [sandbag.key] }),
    );

    expect(items.map(({ id }) => id)).toEqual([goblet.id]);
  });

  it('maps summaries to list items with display labels', async () => {
    const { findExercises } = setUp();

    const items = unwrap(await findExercises({ ...EMPTY_EXERCISE_QUERY, text: 'goblet' }));

    expect(items).toEqual([
      {
        id: goblet.id,
        name: 'My Goblet Squat',
        isCustom: true,
        categoryLabel: 'Strength',
        primaryMuscleLabels: ['Quadriceps'],
        equipmentLabel: 'Sandbag',
        coverImage: null,
      },
    ]);
  });

  it('returns a seeding failure unchanged and reads nothing (A9)', async () => {
    const failure = domainError('exercises.seedFailed', 'Seeding failed.', { cause: 'disk' });
    const { findExercises, logger } = setUp(failedSeeding(failure));

    expect(unwrapErr(await findExercises(EMPTY_EXERCISE_QUERY))).toBe(failure);
    expect(logger.entriesAt('warn')).toEqual([
      expect.objectContaining({
        context: { code: 'exercises.seedFailed', details: { cause: 'disk' } },
      }),
    ]);
  });

  it('returns and logs a storage failure of the exercise reader', async () => {
    const { findExercises, store, logger } = setUp();
    store.failWith(new Error('disk I/O error'));

    expect(unwrapErr(await findExercises(EMPTY_EXERCISE_QUERY)).code).toBe(
      'exercises.storageFailed',
    );
    expect(logger.entriesAt('warn')).toHaveLength(1);
  });

  it('returns a storage failure of the vocabulary reader', async () => {
    const store = new InMemoryExerciseStore({ exercises: [squat] });
    const failingVocabulary = new InMemoryExerciseStore();
    failingVocabulary.failWith('locked');
    const findExercises = createFindExercises({
      ensureLibrarySeeded: seededLibrary(),
      reader: store,
      vocabularyReader: failingVocabulary,
      logger: new RecordingLogger(),
    });

    expect(unwrapErr(await findExercises(EMPTY_EXERCISE_QUERY)).code).toBe(
      'exercises.storageFailed',
    );
  });
});
