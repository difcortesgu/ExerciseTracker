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

import type { Exercise } from '../domain/exercise';

import type { EnsureLibrarySeeded } from './ensure-library-seeded';
import { createPrepareDuplicate } from './prepare-duplicate';

const squat = aBuiltInExercise().named('Barbell Squat').build();

function setUp(
  exercises: readonly Exercise[] = [squat],
  ensureLibrarySeeded: EnsureLibrarySeeded = seededLibrary(),
) {
  const store = new InMemoryExerciseStore({ exercises, vocabulary: builtInVocabularyValues() });
  const logger = new RecordingLogger();
  const prepareDuplicate = createPrepareDuplicate({
    ensureLibrarySeeded,
    reader: store,
    vocabularyReader: store,
    logger,
  });
  return { store, logger, prepareDuplicate };
}

describe('createPrepareDuplicate (S1-23)', () => {
  it('prefills a built-in with "(custom)", its fields and no images; stores nothing', async () => {
    const { prepareDuplicate, store } = setUp();

    const values = unwrap(await prepareDuplicate(squat.id));

    expect(values).toMatchObject({
      name: 'Barbell Squat (custom)',
      category: { label: 'Strength' },
      primaryMuscles: [{ label: 'Quadriceps' }],
      secondaryMuscles: [{ label: 'Glutes' }, { label: 'Hamstrings' }],
      equipment: { label: 'Barbell' },
      instructionsText: squat.instructions.join('\n'),
      photos: [],
      trackedMetrics: ['weight', 'reps'],
    });
    expect(store.writeCount).toBe(0);
  });

  it('picks the first free number when "(custom)" is taken by an active exercise', async () => {
    const taken = aCustomExercise().named('barbell squat (CUSTOM)').build();
    const { prepareDuplicate } = setUp([squat, taken]);

    expect(unwrap(await prepareDuplicate(squat.id)).name).toBe('Barbell Squat (custom 2)');
  });

  it('ignores names of archived exercises', async () => {
    const archived = aCustomExercise().named('Barbell Squat (custom)').archived().build();
    const { prepareDuplicate } = setUp([squat, archived]);

    expect(unwrap(await prepareDuplicate(squat.id)).name).toBe('Barbell Squat (custom)');
  });

  it('does not copy the photos of a custom exercise either (A10)', async () => {
    const goblet = aCustomExercise().withPhotos('a.jpg').build();
    const { prepareDuplicate } = setUp([goblet]);

    expect(unwrap(await prepareDuplicate(goblet.id)).photos).toEqual([]);
  });

  it('returns exercises.notFound for an unknown id', async () => {
    const { prepareDuplicate } = setUp();

    expect(unwrapErr(await prepareDuplicate(exerciseIdOf('missing'))).code).toBe(
      'exercises.notFound',
    );
  });

  it('returns a seeding failure unchanged', async () => {
    const failure = domainError('exercises.seedFailed', 'Seeding failed.');
    const { prepareDuplicate } = setUp([squat], failedSeeding(failure));

    expect(unwrapErr(await prepareDuplicate(squat.id))).toBe(failure);
  });

  it('returns and logs a storage failure', async () => {
    const { prepareDuplicate, store, logger } = setUp();
    store.failWith('disk');

    expect(unwrapErr(await prepareDuplicate(squat.id)).code).toBe('exercises.storageFailed');
    expect(logger.entriesAt('warn')).toHaveLength(1);
  });

  it.each(['summaries', 'vocabulary'] as const)(
    'returns a storage failure when reading the %s fails',
    async (failing) => {
      const healthy = new InMemoryExerciseStore({ exercises: [squat] });
      const broken = new InMemoryExerciseStore({ exercises: [squat] });
      broken.failWith('locked');
      const reader = {
        findById: healthy.findById.bind(healthy),
        findActiveByNameKey: healthy.findActiveByNameKey.bind(healthy),
        listActivePhotoFileNames: healthy.listActivePhotoFileNames.bind(healthy),
        listActiveSummaries: (failing === 'summaries' ? broken : healthy).listActiveSummaries.bind(
          failing === 'summaries' ? broken : healthy,
        ),
      };
      const prepareDuplicate = createPrepareDuplicate({
        ensureLibrarySeeded: seededLibrary(),
        reader,
        vocabularyReader: failing === 'vocabulary' ? broken : healthy,
        logger: new RecordingLogger(),
      });

      expect(unwrapErr(await prepareDuplicate(squat.id)).code).toBe('exercises.storageFailed');
    },
  );
});
