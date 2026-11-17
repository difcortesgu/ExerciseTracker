import {
  aBuiltInExercise,
  aCustomExercise,
  aVocabularyValue,
} from '@test/builders/exercise.builder';
import { FakeExerciseSeedSource } from '@test/fakes/fake-exercise-seed-source';
import { InMemoryExerciseStore } from '@test/fakes/in-memory-exercise-store';
import { RecordingLogger } from '@test/fakes/recording-logger';
import { SequentialIdGenerator } from '@test/fakes/sequential-id-generator';
import { unwrap, unwrapErr } from '@test/support/unwrap';

import type { BuiltInLibraryStore } from './library-seed-ports';
import { createEnsureLibrarySeeded, EnsureLibrarySeededToken } from './ensure-library-seeded';

const squat = aBuiltInExercise().named('Barbell Squat').buildData();
const plank = aBuiltInExercise().named('Plank').buildData();
const barbell = aVocabularyValue().labelled('Barbell').build();

function setUp(options: { seedVersion?: number; store?: InMemoryExerciseStore } = {}) {
  const seedSource = new FakeExerciseSeedSource({ seedVersion: options.seedVersion ?? 1 });
  seedSource.givenDataset({ exercises: [squat, plank], vocabulary: [barbell] });
  const store = options.store ?? new InMemoryExerciseStore();
  const logger = new RecordingLogger();
  const idGenerator = new SequentialIdGenerator('exercise');
  const ensureLibrarySeeded = createEnsureLibrarySeeded({ seedSource, store, idGenerator, logger });
  return { seedSource, store, logger, ensureLibrarySeeded };
}

describe('createEnsureLibrarySeeded (S1-12, S1-13)', () => {
  it('seeds every built-in once on a fresh install, with default metrics and the seed version', async () => {
    const { store, ensureLibrarySeeded } = setUp();

    const report = unwrap(await ensureLibrarySeeded());

    expect(report).toEqual({
      kind: 'applied',
      fromVersion: null,
      toVersion: 1,
      inserted: 2,
      updated: 0,
      archived: 0,
    });
    expect(store.allExercises()).toMatchObject([
      {
        id: 'exercise-1',
        name: 'Barbell Squat',
        origin: 'builtIn',
        trackedMetrics: ['weight', 'reps'],
      },
      { id: 'exercise-2', name: 'Plank' },
    ]);
    expect(await store.readSeedVersion()).toEqual({ ok: true, value: 1 });
    expect(await store.listValues()).toEqual({ ok: true, value: [barbell] });
  });

  it('reads and writes nothing when the stored version equals the asset version', async () => {
    const store = new InMemoryExerciseStore({ seedVersion: 3 });
    const { seedSource, ensureLibrarySeeded } = setUp({ seedVersion: 3, store });

    expect(unwrap(await ensureLibrarySeeded())).toEqual({ kind: 'upToDate', seedVersion: 3 });
    expect(seedSource.loadCount).toBe(0);
    expect(store.writeCount).toBe(0);
  });

  it('changes nothing when the stored version is newer (downgrade)', async () => {
    const store = new InMemoryExerciseStore({ seedVersion: 5 });
    const { seedSource, ensureLibrarySeeded } = setUp({ seedVersion: 2, store });

    expect(unwrap(await ensureLibrarySeeded())).toEqual({
      kind: 'storedVersionNewer',
      storedVersion: 5,
      assetVersion: 2,
    });
    expect(seedSource.loadCount).toBe(0);
    expect(store.writeCount).toBe(0);
  });

  it('updates built-ins in place, archives removed ones and never touches custom exercises', async () => {
    const storedSquat = aBuiltInExercise().withId('old-squat').named('Barbell Squat').build();
    const removed = aBuiltInExercise().withId('old-row').named('Upright Row').build();
    const custom = aCustomExercise()
      .withId('c-1')
      .named('Barbell Squat')
      .withPhotos('a.jpg')
      .build();
    const store = new InMemoryExerciseStore({
      exercises: [storedSquat, removed, custom],
      seedVersion: 1,
    });
    const { seedSource, ensureLibrarySeeded } = setUp({ seedVersion: 2, store });
    seedSource.givenDataset({
      exercises: [{ ...squat, name: 'Back Squat' }, plank],
      vocabulary: [],
    });

    const report = unwrap(await ensureLibrarySeeded());

    expect(report).toMatchObject({
      kind: 'applied',
      fromVersion: 1,
      toVersion: 2,
      inserted: 1,
      updated: 1,
      archived: 1,
    });
    expect(unwrap(await store.findById(storedSquat.id))).toMatchObject({ name: 'Back Squat' });
    expect(unwrap(await store.findById(removed.id, { includeArchived: true }))).toMatchObject({
      archived: true,
    });
    expect(unwrap(await store.findById(custom.id))).toEqual(custom);
  });

  it('logs the report at info level', async () => {
    const { logger, ensureLibrarySeeded } = setUp();

    await ensureLibrarySeeded();

    expect(logger.entriesAt('info')).toEqual([
      expect.objectContaining({
        message: 'Exercise library ready',
        context: expect.objectContaining({ kind: 'applied' }) as unknown,
      }),
    ]);
  });

  it('returns an invalid seed as is and logs it as an error with its code', async () => {
    const { seedSource, logger, store, ensureLibrarySeeded } = setUp();
    seedSource.failWith('Unknown category "yoga".');

    expect(unwrapErr(await ensureLibrarySeeded()).code).toBe('exercises.seedAssetInvalid');
    expect(logger.entriesAt('error')).toEqual([
      expect.objectContaining({
        context: expect.objectContaining({ code: 'exercises.seedAssetInvalid' }) as unknown,
      }),
    ]);
    expect(store.writeCount).toBe(0);
  });

  it.each([
    ['reading the version', 'readSeedVersion'],
    ['listing built-ins', 'listBuiltIns'],
    ['applying the plan', 'applySeed'],
  ] as const)(
    'reports a store failure while %s as exercises.seedFailed with the cause',
    async (_step, method) => {
      const store = new InMemoryExerciseStore();
      const failing: BuiltInLibraryStore = {
        readSeedVersion: () => store.readSeedVersion(),
        listBuiltIns: () => store.listBuiltIns(),
        applySeed: (plan) => store.applySeed(plan),
        [method]: () => {
          store.failWith(new Error('disk full'));
          return store.readSeedVersion();
        },
      };
      const logger = new RecordingLogger();
      const ensureLibrarySeeded = createEnsureLibrarySeeded({
        seedSource: new FakeExerciseSeedSource(),
        store: failing,
        idGenerator: new SequentialIdGenerator(),
        logger,
      });

      const error = unwrapErr(await ensureLibrarySeeded());

      expect(error).toMatchObject({
        code: 'exercises.seedFailed',
        details: { cause: expect.stringMatching(/disk full/) as unknown },
      });
      expect(logger.entriesAt('error')).toHaveLength(1);
    },
  );

  it('resolves with exercises.seedFailed instead of rejecting when a port breaks its contract', async () => {
    const broken = (): Promise<never> => Promise.reject(new Error('native crash'));
    const ensureLibrarySeeded = createEnsureLibrarySeeded({
      seedSource: new FakeExerciseSeedSource(),
      store: { readSeedVersion: broken, listBuiltIns: broken, applySeed: broken },
      idGenerator: new SequentialIdGenerator(),
      logger: new RecordingLogger(),
    });

    expect(unwrapErr(await ensureLibrarySeeded())).toMatchObject({
      code: 'exercises.seedFailed',
      details: { cause: 'native crash' },
    });
  });

  it('treats a blank generated id as a failed run (programmer error), never a rejection', async () => {
    const seedSource = new FakeExerciseSeedSource();
    seedSource.givenDataset({ exercises: [squat], vocabulary: [] });
    const store = new InMemoryExerciseStore();
    const ensureLibrarySeeded = createEnsureLibrarySeeded({
      seedSource,
      store,
      idGenerator: { next: () => ' ' },
      logger: new RecordingLogger(),
    });

    expect(unwrapErr(await ensureLibrarySeeded())).toMatchObject({
      code: 'exercises.seedFailed',
      details: { cause: expect.stringMatching(/id/) as unknown },
    });
    expect(store.writeCount).toBe(0);
  });

  describe('memoizing proxy with retry', () => {
    it('runs once for concurrent and later calls after a success', async () => {
      const { seedSource, store, ensureLibrarySeeded } = setUp();

      const [first, second] = await Promise.all([ensureLibrarySeeded(), ensureLibrarySeeded()]);
      const third = await ensureLibrarySeeded();

      expect(first).toBe(second);
      expect(third).toBe(first);
      expect(seedSource.loadCount).toBe(1);
      expect(store.writeCount).toBe(1);
    });

    it('starts a new run on the next call after a failure (Retry)', async () => {
      const { seedSource, ensureLibrarySeeded } = setUp();
      seedSource.failWith('broken');
      await ensureLibrarySeeded();

      seedSource.givenDataset({ exercises: [squat], vocabulary: [] });

      expect(unwrap(await ensureLibrarySeeded())).toMatchObject({ kind: 'applied', inserted: 1 });
    });
  });
});

describe('EnsureLibrarySeededToken', () => {
  it('names the use case', () => {
    expect(EnsureLibrarySeededToken.description).toBe('exercises.EnsureLibrarySeeded');
  });
});
