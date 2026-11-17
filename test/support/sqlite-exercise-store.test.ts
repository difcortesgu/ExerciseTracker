import { sql } from 'drizzle-orm';

import { aCustomExercise } from '@test/builders/exercise.builder';

import {
  corruptExerciseColumn,
  createSqliteExerciseStore,
  failInsertsInto,
} from './sqlite-exercise-store';

describe('createSqliteExerciseStore', () => {
  it('creates the adapters over a migrated, empty database', async () => {
    const store = await createSqliteExerciseStore();

    expect(await store.reader.listActiveSummaries()).toEqual({ ok: true, value: [] });
    expect(await store.library.readSeedVersion()).toEqual({ ok: true, value: null });
    store.close();
  });

  it('breaks storage by closing the connection', async () => {
    const store = await createSqliteExerciseStore();

    store.breakStorage();

    expect(await store.vocabularyReader.listValues()).toMatchObject({ ok: false });
  });

  it('can make inserts into a table fail and corrupt a stored column', async () => {
    const store = await createSqliteExerciseStore();
    const custom = aCustomExercise().withId('c-1').build();
    await store.writer.saveCustom(custom, []);

    corruptExerciseColumn(store.database, 'c-1', 'name', 'Changed');
    failInsertsInto(store.database, 'exercises');

    expect(store.database.get<{ readonly name: string }>(sql`SELECT name FROM exercises`)).toEqual({
      name: 'Changed',
    });
    expect(
      await store.writer.saveCustom(aCustomExercise().withId('c-2').build(), []),
    ).toMatchObject({ ok: false });
    store.close();
  });
});
