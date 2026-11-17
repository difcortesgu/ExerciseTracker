import { describeBuiltInImageCatalogContract } from '@test/contracts/exercises/built-in-image-catalog.contract';
import { STORAGE_FAILURE, seedBuiltIns } from '@test/contracts/exercises/exercise-store-fixture';
import { aBuiltInExercise } from '@test/builders/exercise.builder';
import {
  corruptExerciseColumn,
  createSqliteExerciseStore,
  sqliteExerciseStoreLifecycle,
  type SqliteExerciseStoreFixture,
} from '@test/support/sqlite-exercise-store';

describeBuiltInImageCatalogContract('SqliteBuiltInImageCatalog', sqliteExerciseStoreLifecycle);

describe('SqliteBuiltInImageCatalog', () => {
  let store: SqliteExerciseStoreFixture;

  beforeEach(async () => {
    store = await createSqliteExerciseStore();
  });

  afterEach(() => {
    store.close();
  });

  it('reports a corrupt images column as exercises.storageFailed', async () => {
    await seedBuiltIns(store, [aBuiltInExercise().withId('b-1').build()]);
    corruptExerciseColumn(store.database, 'b-1', 'images', '[{"path":"../x.jpg","sizeBytes":1}]');

    expect(await store.catalog.listActiveBuiltInImages()).toMatchObject(STORAGE_FAILURE);
  });
});
