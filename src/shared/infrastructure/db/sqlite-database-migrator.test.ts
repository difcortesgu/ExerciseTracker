import { sql } from 'drizzle-orm';

import { describeDatabaseMigratorContract } from '@test/contracts/database-migrator.contract';
import { createTestDatabase, type TestDatabase } from '@test/support/sqlite-test-database';
import { unwrap, unwrapErr } from '@test/support/unwrap';

import type { Migration } from './migration';
import type { SqliteDatabase } from './sqlite-database';
import { SqliteDatabaseMigrator } from './sqlite-database-migrator';

const createNotes: Migration = {
  version: 1,
  name: '0000_create_notes',
  statements: ['CREATE TABLE notes (id TEXT PRIMARY KEY NOT NULL, body TEXT NOT NULL)'],
};
const createTags: Migration = {
  version: 2,
  name: '0001_create_tags',
  statements: [
    'CREATE TABLE tags (id TEXT PRIMARY KEY NOT NULL)',
    'CREATE TABLE note_tags (note_id TEXT NOT NULL, tag_id TEXT NOT NULL)',
  ],
};
const addNoteTitle: Migration = {
  version: 3,
  name: '0002_add_note_title',
  statements: ["ALTER TABLE notes ADD COLUMN title TEXT NOT NULL DEFAULT ''"],
};
const brokenAfterFirstStatement: Migration = {
  version: 3,
  name: '0002_broken',
  statements: ['CREATE TABLE archive (id TEXT PRIMARY KEY NOT NULL)', 'THIS IS NOT SQL'],
};

const tableNames = (database: SqliteDatabase): readonly string[] =>
  database
    .all<{ readonly name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
    )
    .map(({ name }) => name);

const migratorFor = (database: SqliteDatabase, migrations: readonly Migration[]) =>
  new SqliteDatabaseMigrator({ openDatabase: () => database, migrations });

/**
 * Test double (Proxy over the real database): the first `get` (the version read on open) works,
 * every later one throws, as when the disk fails part-way through a run.
 */
const withVersionReadsFailingAfterOpen = (database: SqliteDatabase): SqliteDatabase => {
  let reads = 0;
  return new Proxy(database, {
    get(target, property, receiver) {
      if (property === 'get' && reads++ > 0) {
        return () => {
          throw new Error('disk I/O error');
        };
      }
      const value: unknown = Reflect.get(target, property, receiver);
      return value;
    },
  });
};

describeDatabaseMigratorContract('SqliteDatabaseMigrator', {
  create: () => {
    const testDatabase = createTestDatabase();
    return Object.assign(migratorFor(testDatabase.database, [createNotes, createTags]), {
      close: testDatabase.close,
    });
  },
  dispose: (fixture) => fixture.close(),
});

describe('SqliteDatabaseMigrator', () => {
  let testDatabase: TestDatabase;
  let database: SqliteDatabase;

  beforeEach(() => {
    testDatabase = createTestDatabase();
    database = testDatabase.database;
  });

  afterEach(() => {
    testDatabase.close();
  });

  it('applies every migration of an empty database in order and records the version', async () => {
    const report = unwrap(await migratorFor(database, [createNotes, createTags]).migrate());

    expect(report).toEqual({
      fromVersion: 0,
      toVersion: 2,
      applied: ['0000_create_notes', '0001_create_tags'],
    });
    expect(tableNames(database)).toEqual(expect.arrayContaining(['notes', 'tags', 'note_tags']));
  });

  it('applies migrations in version order even when given out of order', async () => {
    const report = unwrap(await migratorFor(database, [createTags, createNotes]).migrate());

    expect(report.applied).toEqual(['0000_create_notes', '0001_create_tags']);
  });

  it('changes nothing when the database is already up to date', async () => {
    await migratorFor(database, [createNotes, createTags]).migrate();
    const tablesBefore = tableNames(database);

    const report = unwrap(await migratorFor(database, [createNotes, createTags]).migrate());

    expect(report).toEqual({ fromVersion: 2, toVersion: 2, applied: [] });
    expect(tableNames(database)).toEqual(tablesBefore);
  });

  it('applies only the migrations after the current version', async () => {
    await migratorFor(database, [createNotes]).migrate();

    const report = unwrap(
      await migratorFor(database, [createNotes, createTags, addNoteTitle]).migrate(),
    );

    expect(report).toEqual({
      fromVersion: 1,
      toVersion: 3,
      applied: ['0001_create_tags', '0002_add_note_title'],
    });
  });

  it('leaves a database written by a newer app version untouched (ADR-001 §11)', async () => {
    await migratorFor(database, [createNotes, createTags, addNoteTitle]).migrate();
    const tablesBefore = tableNames(database);

    const report = unwrap(await migratorFor(database, [createNotes]).migrate());

    expect(report).toEqual({ fromVersion: 3, toVersion: 3, applied: [] });
    expect(tableNames(database)).toEqual(tablesBefore);
  });

  it('reports the reached version without re-reading it after the last migration', async () => {
    const failingReads = withVersionReadsFailingAfterOpen(database);

    const report = unwrap(await migratorFor(failingReads, [createNotes, createTags]).migrate());

    expect(report).toEqual({
      fromVersion: 0,
      toVersion: 2,
      applied: ['0000_create_notes', '0001_create_tags'],
    });
  });

  it('succeeds with nothing to do when there are no migrations', async () => {
    expect(unwrap(await migratorFor(database, []).migrate())).toEqual({
      fromVersion: 0,
      toVersion: 0,
      applied: [],
    });
  });

  describe('when a migration fails', () => {
    it('rolls that migration back and keeps the last successful version', async () => {
      const migrations = [createNotes, createTags, brokenAfterFirstStatement];

      const error = unwrapErr(await migratorFor(database, migrations).migrate());

      expect(error).toMatchObject({
        code: 'db.migrationFailed',
        details: { migration: '0002_broken', fromVersion: 0, reachedVersion: 2 },
      });
      expect(tableNames(database)).not.toContain('archive');
      const retry = unwrapErr(await migratorFor(database, migrations).migrate());
      expect(retry.details).toMatchObject({ fromVersion: 2, reachedVersion: 2 });
    });

    it('describes the underlying database error', async () => {
      const migrations = [createNotes, createTags, brokenAfterFirstStatement];

      const error = unwrapErr(await migratorFor(database, migrations).migrate());

      expect(error.message).toMatch(/0002_broken/);
      expect(error.details).toMatchObject({ cause: expect.stringMatching(/syntax error/) });
    });

    it('still resolves to db.migrationFailed when the version can no longer be read', async () => {
      const failingReads = withVersionReadsFailingAfterOpen(database);
      const migrations = [createNotes, createTags, brokenAfterFirstStatement];

      const error = unwrapErr(await migratorFor(failingReads, migrations).migrate());

      expect(error).toMatchObject({
        code: 'db.migrationFailed',
        details: { migration: '0002_broken', fromVersion: 0, reachedVersion: 2 },
      });
    });
  });

  it('returns db.openFailed when the database cannot be opened', async () => {
    const migrator = new SqliteDatabaseMigrator({
      openDatabase: () => {
        throw new Error('disk I/O error');
      },
      migrations: [createNotes],
    });

    expect(unwrapErr(await migrator.migrate())).toMatchObject({
      code: 'db.openFailed',
      details: { cause: 'disk I/O error' },
    });
  });

  it('returns db.openFailed when the opened database cannot be read', async () => {
    const unusable = createTestDatabase();
    unusable.close();

    const error = unwrapErr(await migratorFor(unusable.database, [createNotes]).migrate());

    expect(error).toMatchObject({
      code: 'db.openFailed',
      details: { cause: expect.stringMatching(/not open/) },
    });
  });

  it('describes causes that are not Error instances', async () => {
    const migrator = new SqliteDatabaseMigrator({
      openDatabase: () => {
        throw 'native failure';
      },
      migrations: [],
    });

    expect(unwrapErr(await migrator.migrate()).details).toEqual({ cause: 'native failure' });
  });

  it.each([
    ['a gap in the versions', [createNotes, addNoteTitle]],
    ['a duplicate version', [createNotes, { ...createTags, version: 1 }]],
    ['versions not starting at 1', [createTags]],
  ])('rejects a migration list with %s as a programmer error', (_case, migrations) => {
    expect(() => migratorFor(database, migrations)).toThrow(/versions 1\.\.n/);
  });
});
