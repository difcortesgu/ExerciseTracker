import { domainError } from '@shared/domain/domain-error';
import {
  aBuiltInExercise,
  aCustomExercise,
  aVocabularyValue,
  builtInVocabularyValues,
  vocabularyKeyOf,
} from '@test/builders/exercise.builder';
import { anExerciseDraft, existing, newValue } from '@test/builders/exercise-draft.builder';
import { InMemoryExerciseStore } from '@test/fakes/in-memory-exercise-store';
import { RecordingLogger } from '@test/fakes/recording-logger';
import { SequentialIdGenerator } from '@test/fakes/sequential-id-generator';
import { failedSeeding, seededLibrary } from '@test/fakes/stub-ensure-library-seeded';
import { unwrap, unwrapErr } from '@test/support/unwrap';

import { createCreateCustomExercise } from './create-custom-exercise';
import type { EnsureLibrarySeeded } from './ensure-library-seeded';
import type { SaveExerciseError } from './save-exercise-errors';

const squat = aBuiltInExercise().named('Barbell Squat').build();
const archivedCustom = aCustomExercise().named('Old Lunge').archived().build();

function setUp(ensureLibrarySeeded: EnsureLibrarySeeded = seededLibrary()) {
  const store = new InMemoryExerciseStore({
    exercises: [squat, archivedCustom],
    vocabulary: builtInVocabularyValues(),
  });
  const logger = new RecordingLogger();
  const createCustomExercise = createCreateCustomExercise({
    ensureLibrarySeeded,
    reader: store,
    writer: store,
    vocabularyReader: store,
    idGenerator: new SequentialIdGenerator('custom'),
    logger,
  });
  return { store, logger, createCustomExercise };
}

const issueCodes = (error: SaveExerciseError): readonly string[] =>
  error.code === 'exercises.invalidExercise'
    ? error.issues.map(({ field, code }) => `${field}:${code}`)
    : [];

describe('createCreateCustomExercise (S1-19, S1-29)', () => {
  it('stores a valid draft as an active custom exercise and returns its new id', async () => {
    const { createCustomExercise, store } = setUp();

    const id = unwrap(await createCustomExercise(anExerciseDraft().withPhotos('p.jpg').build()));

    expect(id).toBe('custom-1');
    expect(unwrap(await store.findById(id))).toMatchObject({
      id: 'custom-1',
      origin: 'custom',
      name: 'My Goblet Squat',
      equipment: vocabularyKeyOf('Kettlebells'),
      instructions: ['Hold the kettlebell at your chest.', 'Squat down and stand up.'],
      images: [{ kind: 'photo', fileName: 'p.jpg' }],
      trackedMetrics: ['weight', 'reps'],
      archived: false,
    });
  });

  it('persists a new user-defined value together with the exercise', async () => {
    const { createCustomExercise, store } = setUp();

    unwrap(
      await createCustomExercise(
        anExerciseDraft()
          .with({ equipment: newValue('Sandbag') })
          .build(),
      ),
    );

    expect(unwrap(await store.listValues())).toContainEqual(
      aVocabularyValue().ofKind('equipment').labelled('Sandbag').custom().build(),
    );
  });

  it.each(['barbell squat', '  Barbell   Squat ', 'Bárbell Squat'])(
    'rejects %j because a built-in has that name, naming it',
    async (name) => {
      const { createCustomExercise, store } = setUp();

      const error = unwrapErr(await createCustomExercise(anExerciseDraft().named(name).build()));

      expect(error).toEqual({
        code: 'exercises.invalidExercise',
        message: expect.any(String),
        issues: [
          expect.objectContaining({
            field: 'name',
            code: 'exercises.duplicateName',
            details: { existingName: 'Barbell Squat' },
          }),
        ],
      });
      expect(store.writeCount).toBe(0);
    },
  );

  it('accepts the name of an archived custom exercise (Q6)', async () => {
    const { createCustomExercise } = setUp();

    expect((await createCustomExercise(anExerciseDraft().named('old lunge').build())).ok).toBe(
      true,
    );
  });

  it('returns every field issue and the name conflict together, storing nothing', async () => {
    const { createCustomExercise, store, logger } = setUp();
    const draft = anExerciseDraft()
      .named('Barbell Squat')
      .with({ trackedMetrics: [], primaryMuscles: [existing('Unknown')] })
      .build();

    const error = unwrapErr(await createCustomExercise(draft));

    expect(issueCodes(error)).toEqual([
      'primaryMuscles:exercises.unknownMuscle',
      'trackedMetrics:exercises.noTrackedMetric',
      'name:exercises.duplicateName',
    ]);
    expect(store.writeCount).toBe(0);
    expect(logger.entries).toHaveLength(0);
  });

  it('returns a seeding failure unchanged and stores nothing', async () => {
    const failure = domainError('exercises.seedFailed', 'Seeding failed.');
    const { createCustomExercise, store } = setUp(failedSeeding(failure));

    expect(unwrapErr(await createCustomExercise(anExerciseDraft().build()))).toBe(failure);
    expect(store.writeCount).toBe(0);
  });

  it('returns and logs a storage failure', async () => {
    const { createCustomExercise, store, logger } = setUp();
    store.failWith('disk full');

    expect(unwrapErr(await createCustomExercise(anExerciseDraft().build())).code).toBe(
      'exercises.storageFailed',
    );
    expect(logger.entriesAt('warn')).toHaveLength(1);
  });

  it.each(['vocabulary', 'name lookup', 'write'] as const)(
    'returns a storage failure when the %s fails',
    async (failing) => {
      const healthy = new InMemoryExerciseStore({ vocabulary: builtInVocabularyValues() });
      const broken = new InMemoryExerciseStore();
      broken.failWith('locked');
      const pick = (part: typeof failing) => (failing === part ? broken : healthy);
      const createCustomExercise = createCreateCustomExercise({
        ensureLibrarySeeded: seededLibrary(),
        reader: pick('name lookup'),
        writer: pick('write'),
        vocabularyReader: pick('vocabulary'),
        idGenerator: new SequentialIdGenerator(),
        logger: new RecordingLogger(),
      });

      expect(unwrapErr(await createCustomExercise(anExerciseDraft().build())).code).toBe(
        'exercises.storageFailed',
      );
    },
  );
});
