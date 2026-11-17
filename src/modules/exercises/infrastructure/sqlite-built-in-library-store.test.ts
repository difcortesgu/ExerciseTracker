import { describeBuiltInLibraryStoreContract } from '@test/contracts/exercises/built-in-library-store.contract';
import { aSeedPlan, STORAGE_FAILURE } from '@test/contracts/exercises/exercise-store-fixture';
import { aBuiltInExercise, aVocabularyValue } from '@test/builders/exercise.builder';
import {
  corruptExerciseColumn,
  createSqliteExerciseStore,
  failInsertsInto,
  sqliteExerciseStoreLifecycle,
  type SqliteExerciseStoreFixture,
} from '@test/support/sqlite-exercise-store';

describeBuiltInLibraryStoreContract('SqliteBuiltInLibraryStore', sqliteExerciseStoreLifecycle);

/** More rows than one insert batch, so the batching inside the transaction is exercised. */
const MANY = 230;

const manyBuiltIns = (prefix: string) =>
  Array.from({ length: MANY }, (_unused, index) =>
    aBuiltInExercise()
      .withId(`${prefix}-${String(index).padStart(3, '0')}`)
      .named(`${prefix} ${index}`)
      .build(),
  );

describe('SqliteBuiltInLibraryStore', () => {
  let store: SqliteExerciseStoreFixture;

  beforeEach(async () => {
    store = await createSqliteExerciseStore();
  });

  afterEach(() => {
    store.close();
  });

  it('inserts, updates and archives more built-ins than one batch in a single run', async () => {
    const first = manyBuiltIns('a');
    await store.library.applySeed(aSeedPlan({ insert: first }));
    const renamed = first.map((exercise) => ({ ...exercise, name: `${exercise.name} v2` }));

    await store.library.applySeed(
      aSeedPlan({ seedVersion: 2, update: renamed, archive: renamed.map(({ id }) => id) }),
    );

    const listed = await store.library.listBuiltIns();
    expect(listed.ok && listed.value).toEqual(
      renamed.map((exercise) => ({ ...exercise, archived: true })),
    );
  });

  it('records the new seed version on every run (single seed row)', async () => {
    await store.library.applySeed(aSeedPlan({ seedVersion: 1 }));

    await store.library.applySeed(aSeedPlan({ seedVersion: 4 }));

    expect(await store.library.readSeedVersion()).toEqual({ ok: true, value: 4 });
  });

  it('writes nothing when the seed version cannot be recorded', async () => {
    failInsertsInto(store.database, 'exercise_library_seed');

    const applied = await store.library.applySeed(
      aSeedPlan({
        insert: manyBuiltIns('a'),
        vocabulary: [aVocabularyValue().labelled('Cable').build()],
      }),
    );

    expect(applied).toMatchObject(STORAGE_FAILURE);
    expect(await store.library.listBuiltIns()).toEqual({ ok: true, value: [] });
    expect(await store.vocabularyReader.listValues()).toEqual({ ok: true, value: [] });
  });

  it('reports a corrupt built-in row as exercises.storageFailed', async () => {
    await store.library.applySeed(
      aSeedPlan({ insert: [aBuiltInExercise().withId('b-1').build()] }),
    );
    corruptExerciseColumn(store.database, 'b-1', 'source_key', null);

    expect(await store.library.listBuiltIns()).toMatchObject(STORAGE_FAILURE);
  });
});
