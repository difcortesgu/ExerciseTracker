import { sql } from 'drizzle-orm';

import { describeExerciseWriterContract } from '@test/contracts/exercises/exercise-writer.contract';
import { STORAGE_FAILURE } from '@test/contracts/exercises/exercise-store-fixture';
import { aCustomExercise, aVocabularyValue } from '@test/builders/exercise.builder';
import {
  createSqliteExerciseStore,
  failInsertsInto,
  sqliteExerciseStoreLifecycle,
  type SqliteExerciseStoreFixture,
} from '@test/support/sqlite-exercise-store';

describeExerciseWriterContract('SqliteExerciseWriter', sqliteExerciseStoreLifecycle);

describe('SqliteExerciseWriter', () => {
  let store: SqliteExerciseStoreFixture;

  beforeEach(async () => {
    store = await createSqliteExerciseStore();
  });

  afterEach(() => {
    store.close();
  });

  it('stores the comparison key of the name on every save', async () => {
    await store.writer.saveCustom(aCustomExercise().withId('c-1').named('Préss  Up').build(), []);
    await store.writer.saveCustom(
      aCustomExercise().withId('c-1').named('Goblet SQUAT').build(),
      [],
    );

    expect(store.database.all(sql`SELECT name_key FROM exercises`)).toEqual([
      { name_key: 'goblet squat' },
    ]);
  });

  it('stores neither the exercise nor any value when a value cannot be written', async () => {
    failInsertsInto(store.database, 'exercise_vocabulary_values');
    const custom = aCustomExercise().withId('c-1').build();

    const saved = await store.writer.saveCustom(custom, [
      aVocabularyValue().labelled('Sandbag').custom().build(),
    ]);

    expect(saved).toMatchObject(STORAGE_FAILURE);
    expect(await store.reader.findById(custom.id)).toEqual({ ok: true, value: null });
  });
});
