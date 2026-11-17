import { sql } from 'drizzle-orm';

import { describeVocabularyReaderContract } from '@test/contracts/exercises/vocabulary-reader.contract';
import { STORAGE_FAILURE } from '@test/contracts/exercises/exercise-store-fixture';
import {
  createSqliteExerciseStore,
  sqliteExerciseStoreLifecycle,
  type SqliteExerciseStoreFixture,
} from '@test/support/sqlite-exercise-store';

describeVocabularyReaderContract('SqliteVocabularyReader', sqliteExerciseStoreLifecycle);

describe('SqliteVocabularyReader', () => {
  let store: SqliteExerciseStoreFixture;

  beforeEach(async () => {
    store = await createSqliteExerciseStore();
  });

  afterEach(() => {
    store.close();
  });

  it('reports a corrupt value row as exercises.storageFailed', async () => {
    store.database.run(
      sql`INSERT INTO exercise_vocabulary_values (kind, key, origin, label) VALUES ('level', 'expert', 'builtIn', 'Expert')`,
    );

    expect(await store.vocabularyReader.listValues()).toMatchObject(STORAGE_FAILURE);
  });
});
