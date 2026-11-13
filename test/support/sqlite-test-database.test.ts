import { sql } from 'drizzle-orm';

import type { SqliteDatabase } from '@shared/infrastructure/db/sqlite-database';

import { createTestDatabase } from './sqlite-test-database';

const countTables = (database: SqliteDatabase): number =>
  database.all<{ readonly name: string }>(sql`SELECT name FROM sqlite_master WHERE type = 'table'`)
    .length;

describe('createTestDatabase', () => {
  it('returns a working, empty in-memory database typed like the app database', () => {
    const { database, close } = createTestDatabase();

    expect(countTables(database)).toBe(0);
    database.run(sql`CREATE TABLE sample (id TEXT PRIMARY KEY)`);
    expect(countTables(database)).toBe(1);
    close();
  });

  it('isolates databases from each other', () => {
    const first = createTestDatabase();
    const second = createTestDatabase();

    first.database.run(sql`CREATE TABLE sample (id TEXT PRIMARY KEY)`);

    expect(countTables(second.database)).toBe(0);
    first.close();
    second.close();
  });

  it('closes the underlying connection', () => {
    const { database, close } = createTestDatabase();

    close();

    expect(() => countTables(database)).toThrow(/not open/);
  });
});
