import { describeExerciseReaderContract } from '@test/contracts/exercises/exercise-reader.contract';
import {
  aSeedPlan,
  STORAGE_FAILURE,
  saveCustoms,
  seedBuiltIns,
} from '@test/contracts/exercises/exercise-store-fixture';
import {
  aBuiltInExercise,
  aCustomExercise,
  exerciseIdOf,
  vocabularyKeyOf,
} from '@test/builders/exercise.builder';
import {
  corruptExerciseColumn,
  createSqliteExerciseStore,
  sqliteExerciseStoreLifecycle,
  type SqliteExerciseStoreFixture,
} from '@test/support/sqlite-exercise-store';

describeExerciseReaderContract('SqliteExerciseReader', sqliteExerciseStoreLifecycle);

const LIBRARY_SIZE = 900;

describe('SqliteExerciseReader', () => {
  let store: SqliteExerciseStoreFixture;

  beforeEach(async () => {
    store = await createSqliteExerciseStore();
  });

  afterEach(() => {
    store.close();
  });

  it(`lists ${LIBRARY_SIZE} built-ins as summaries (S1-14 library size)`, async () => {
    const library = Array.from({ length: LIBRARY_SIZE }, (_unused, index) =>
      aBuiltInExercise().withId(`b-${index}`).named(`Exercise ${index}`).build(),
    );
    await seedBuiltIns(store, library);

    const listed = await store.reader.listActiveSummaries();

    expect(listed.ok && listed.value).toHaveLength(LIBRARY_SIZE);
  });

  it('finds the exercise with the lowest id when several active ones share a name key', async () => {
    await seedBuiltIns(store, [aBuiltInExercise().withId('b-2').named('Plank').build()]);
    await saveCustoms(store, aCustomExercise().withId('a-1').named('PLANK').build());

    const found = await store.reader.findActiveByNameKey(vocabularyKeyOf('plank'));

    expect(found).toMatchObject({ ok: true, value: { id: 'a-1' } });
  });

  it('reports a corrupt row as exercises.storageFailed from every read', async () => {
    await saveCustoms(
      store,
      aCustomExercise().withId('c-1').named('Goblet').withPhotos('a.jpg').build(),
    );
    corruptExerciseColumn(store.database, 'c-1', 'images', '{broken');

    expect(await store.reader.listActiveSummaries()).toMatchObject(STORAGE_FAILURE);
    expect(await store.reader.findById(exerciseIdOf('c-1'))).toMatchObject(STORAGE_FAILURE);
    expect(await store.reader.findActiveByNameKey(vocabularyKeyOf('goblet'))).toMatchObject(
      STORAGE_FAILURE,
    );
    expect(await store.reader.listActivePhotoFileNames()).toMatchObject(STORAGE_FAILURE);
  });

  it('describes the corrupt row in the failure cause', async () => {
    await seedBuiltIns(store, [aBuiltInExercise().withId('b-1').build()]);
    corruptExerciseColumn(store.database, 'b-1', 'level', 'master');

    expect(await store.reader.findById(exerciseIdOf('b-1'))).toMatchObject({
      ok: false,
      error: { details: { cause: expect.stringMatching(/exercise "b-1": level/) as unknown } },
    });
  });

  it('ignores corrupt archived rows when only active ones are read', async () => {
    const gone = aBuiltInExercise().withId('b-1').build();
    await seedBuiltIns(store, [gone]);
    await store.library.applySeed(aSeedPlan({ seedVersion: 2, archive: [gone.id] }));
    corruptExerciseColumn(store.database, 'b-1', 'images', '{broken');

    expect(await store.reader.listActiveSummaries()).toEqual({ ok: true, value: [] });
    expect(await store.reader.findById(gone.id)).toEqual({ ok: true, value: null });
  });
});
