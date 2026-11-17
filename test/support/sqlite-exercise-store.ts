import { sql } from 'drizzle-orm';

import { SqliteBuiltInImageCatalog } from '@modules/exercises/infrastructure/sqlite-built-in-image-catalog';
import { SqliteBuiltInLibraryStore } from '@modules/exercises/infrastructure/sqlite-built-in-library-store';
import { SqliteExerciseReader } from '@modules/exercises/infrastructure/sqlite-exercise-reader';
import { SqliteExerciseWriter } from '@modules/exercises/infrastructure/sqlite-exercise-writer';
import { SqliteVocabularyReader } from '@modules/exercises/infrastructure/sqlite-vocabulary-reader';
import { APP_MIGRATIONS } from '@shared/infrastructure/db/app-migrations';
import type { SqliteDatabase } from '@shared/infrastructure/db/sqlite-database';
import { SqliteDatabaseMigrator } from '@shared/infrastructure/db/sqlite-database-migrator';

import type { ExerciseStoreFixture } from '../contracts/exercises/exercise-store-fixture';

import { createTestDatabase } from './sqlite-test-database';
import { unwrap } from './unwrap';

/** The exercises SQLite adapters over one fresh, migrated in-memory database. */
export interface SqliteExerciseStoreFixture extends ExerciseStoreFixture {
  readonly database: SqliteDatabase;
  readonly close: () => void;
}

/**
 * Creates every exercises SQLite adapter over a fresh `:memory:` database migrated with the real
 * drizzle-kit bundle (S1-04, S1-14), so the contract suites run against the production schema.
 * `breakStorage` closes the connection: every later query throws, as on a disk failure.
 */
export async function createSqliteExerciseStore(): Promise<SqliteExerciseStoreFixture> {
  const { database, close } = createTestDatabase();
  const migrator = new SqliteDatabaseMigrator({
    openDatabase: () => database,
    migrations: APP_MIGRATIONS,
  });
  unwrap(await migrator.migrate());
  return {
    database,
    close,
    reader: new SqliteExerciseReader(database),
    writer: new SqliteExerciseWriter(database),
    vocabularyReader: new SqliteVocabularyReader(database),
    catalog: new SqliteBuiltInImageCatalog(database),
    library: new SqliteBuiltInLibraryStore(database),
    breakStorage: close,
  };
}

/** Contract-harness lifecycle: a fresh store per case, closed afterwards. */
export const sqliteExerciseStoreLifecycle = {
  create: createSqliteExerciseStore,
  dispose: (fixture: SqliteExerciseStoreFixture) => fixture.close(),
};

/**
 * Makes every insert into `table` fail inside SQLite (a trigger raising an error), to prove that a
 * multi-table write is rolled back completely.
 */
export function failInsertsInto(database: SqliteDatabase, table: string): void {
  database.run(
    sql.raw(
      `CREATE TRIGGER fail_${table} BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT, 'disk full'); END`,
    ),
  );
}

/** Overwrites one column of a stored exercise with raw SQL (a corrupt row, for mapper failures). */
export function corruptExerciseColumn(
  database: SqliteDatabase,
  id: string,
  column: string,
  value: string | null,
): void {
  database.run(sql`UPDATE exercises SET ${sql.identifier(column)} = ${value} WHERE id = ${id}`);
}
