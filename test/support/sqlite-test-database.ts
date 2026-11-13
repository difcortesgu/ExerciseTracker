import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import type { SqliteDatabase } from '@shared/infrastructure/db/sqlite-database';

const IN_MEMORY = ':memory:';

export interface TestDatabase {
  readonly database: SqliteDatabase;
  readonly close: () => void;
}

/**
 * A fresh, isolated in-memory SQLite database with the same Drizzle API as the app's expo-sqlite
 * database (ADR-001). Every call returns a new database, so no state leaks between tests.
 */
export function createTestDatabase(): TestDatabase {
  const connection = new Database(IN_MEMORY);
  return { database: drizzle(connection), close: () => connection.close() };
}
