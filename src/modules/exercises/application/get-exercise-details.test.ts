import { domainError } from '@shared/domain/domain-error';
import {
  aBuiltInExercise,
  aCustomExercise,
  builtInVocabularyValues,
  exerciseIdOf,
} from '@test/builders/exercise.builder';
import { InMemoryExerciseStore } from '@test/fakes/in-memory-exercise-store';
import { RecordingLogger } from '@test/fakes/recording-logger';
import { failedSeeding, seededLibrary } from '@test/fakes/stub-ensure-library-seeded';
import { unwrap, unwrapErr } from '@test/support/unwrap';

import type { EnsureLibrarySeeded } from './ensure-library-seeded';
import { createGetExerciseDetails } from './get-exercise-details';

const squat = aBuiltInExercise().named('Barbell Squat').build();
const archived = aCustomExercise().named('Old Squat').archived().build();

function setUp(ensureLibrarySeeded: EnsureLibrarySeeded = seededLibrary()) {
  const store = new InMemoryExerciseStore({
    exercises: [squat, archived],
    vocabulary: builtInVocabularyValues(),
  });
  const logger = new RecordingLogger();
  const getExerciseDetails = createGetExerciseDetails({
    ensureLibrarySeeded,
    reader: store,
    vocabularyReader: store,
    logger,
  });
  return { store, logger, getExerciseDetails };
}

describe('createGetExerciseDetails (S1-15, S1-17)', () => {
  it('returns the full exercise with labels for an active id', async () => {
    const { getExerciseDetails } = setUp();

    const details = unwrap(await getExerciseDetails(squat.id));

    expect(details).toMatchObject({
      id: squat.id,
      name: 'Barbell Squat',
      isCustom: false,
      category: { label: 'Strength' },
      secondaryMuscles: [{ label: 'Glutes' }, { label: 'Hamstrings' }],
      images: squat.images,
      builtIn: { level: 'beginner', force: 'push', mechanic: 'compound' },
    });
  });

  it.each([
    ['an unknown id', exerciseIdOf('missing')],
    ['an archived id', archived.id],
  ])('returns exercises.notFound for %s and logs it at info level', async (_case, id) => {
    const { getExerciseDetails, logger } = setUp();

    const error = unwrapErr(await getExerciseDetails(id));

    expect(error).toEqual(
      domainError('exercises.notFound', 'The exercise does not exist.', { id }),
    );
    expect(logger.entriesAt('info')).toHaveLength(1);
    expect(logger.entriesAt('warn')).toHaveLength(0);
  });

  it('returns a seeding failure unchanged', async () => {
    const failure = domainError('exercises.seedAssetInvalid', 'Bad seed.');
    const { getExerciseDetails } = setUp(failedSeeding(failure));

    expect(unwrapErr(await getExerciseDetails(squat.id))).toBe(failure);
  });

  it('returns and logs a storage failure at warn level', async () => {
    const { getExerciseDetails, store, logger } = setUp();
    store.failWith('disk');

    expect(unwrapErr(await getExerciseDetails(squat.id)).code).toBe('exercises.storageFailed');
    expect(logger.entriesAt('warn')).toHaveLength(1);
  });

  it('returns a storage failure of the vocabulary reader', async () => {
    const failingVocabulary = new InMemoryExerciseStore();
    failingVocabulary.failWith('locked');
    const getExerciseDetails = createGetExerciseDetails({
      ensureLibrarySeeded: seededLibrary(),
      reader: new InMemoryExerciseStore({ exercises: [squat] }),
      vocabularyReader: failingVocabulary,
      logger: new RecordingLogger(),
    });

    expect(unwrapErr(await getExerciseDetails(squat.id)).code).toBe('exercises.storageFailed');
  });
});
