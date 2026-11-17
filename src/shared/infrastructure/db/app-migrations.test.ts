import { sql } from 'drizzle-orm';

import { createTestDatabase, type TestDatabase } from '@test/support/sqlite-test-database';
import { unwrap, unwrapErr } from '@test/support/unwrap';

import { APP_MIGRATIONS } from './app-migrations';
import type { SqliteDatabase } from './sqlite-database';
import { SqliteDatabaseMigrator } from './sqlite-database-migrator';

/** Tables owned by the exercises module (ADR-004 §2, S1-04). */
const EXERCISES_TABLES = ['exercise_library_seed', 'exercise_vocabulary_values', 'exercises'];

const tableNames = (database: SqliteDatabase): readonly string[] =>
  database
    .all<{ readonly name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
    )
    .map(({ name }) => name);

const indexNames = (database: SqliteDatabase): readonly string[] =>
  database
    .all<{ readonly name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'`,
    )
    .map(({ name }) => name);

const migrateApp = (database: SqliteDatabase) =>
  new SqliteDatabaseMigrator({
    openDatabase: () => database,
    migrations: APP_MIGRATIONS,
  }).migrate();

describe('APP_MIGRATIONS (drizzle-kit bundle, S1-04)', () => {
  let testDatabase: TestDatabase;

  beforeEach(() => {
    testDatabase = createTestDatabase();
  });

  afterEach(() => {
    testDatabase.close();
  });

  it('is built from the generated drizzle-kit bundle, versioned 1..n', () => {
    expect(APP_MIGRATIONS.length).toBeGreaterThan(0);
    expect(APP_MIGRATIONS.map(({ version }) => version)).toEqual(
      APP_MIGRATIONS.map((_migration, index) => index + 1),
    );
  });

  it('creates every exercises table on a fresh database and records the last version', async () => {
    const report = unwrap(await migrateApp(testDatabase.database));

    expect(tableNames(testDatabase.database)).toEqual(expect.arrayContaining(EXERCISES_TABLES));
    expect(report).toEqual({
      fromVersion: 0,
      toVersion: APP_MIGRATIONS.length,
      applied: APP_MIGRATIONS.map(({ name }) => name),
    });
  });

  it('indexes the name key and the archived flag, and keeps source keys unique', async () => {
    unwrap(await migrateApp(testDatabase.database));

    expect(indexNames(testDatabase.database)).toEqual(
      expect.arrayContaining([
        'exercises_name_key_idx',
        'exercises_archived_idx',
        'exercises_source_key_unique',
      ]),
    );
  });

  it('upgrades a database written by the Sprint 0.5 build (version table only)', async () => {
    const sprintZeroFive = new SqliteDatabaseMigrator({
      openDatabase: () => testDatabase.database,
      migrations: [],
    });
    unwrap(await sprintZeroFive.migrate());

    const report = unwrap(await migrateApp(testDatabase.database));

    expect(report.fromVersion).toBe(0);
    expect(report.toVersion).toBe(APP_MIGRATIONS.length);
    expect(tableNames(testDatabase.database)).toEqual(expect.arrayContaining(EXERCISES_TABLES));
  });

  it('rolls the first migration back completely when its last statement fails', async () => {
    // The generated migration ends with this index; an existing index of that name makes it fail
    // after every exercises table was already created inside the transaction.
    testDatabase.database.run(sql`CREATE TABLE clash (archived INTEGER)`);
    testDatabase.database.run(sql`CREATE INDEX exercises_archived_idx ON clash (archived)`);

    const error = unwrapErr(await migrateApp(testDatabase.database));

    expect(error).toMatchObject({
      code: 'db.migrationFailed',
      details: { fromVersion: 0, reachedVersion: 0 },
    });
    expect(tableNames(testDatabase.database)).toEqual(['clash', 'schema_migrations']);
  });
});
