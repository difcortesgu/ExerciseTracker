import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { createToken } from '@shared/application/di/token';

/**
 * The typed Drizzle database every SQLite adapter is written against (S0-18). Both drivers in use
 * are synchronous: `expo-sqlite` in the app and `better-sqlite3` (in-memory) in Jest, so adapters
 * are written once and the same contract suites run against a fresh database per test.
 * Drizzle types never leave the infrastructure layer.
 */
export type SqliteDatabase = BaseSQLiteDatabase<'sync', unknown>;

/** The app's single database connection; registered and resolved only in the composition root. */
export const SqliteDatabaseToken = createToken<SqliteDatabase>('shared.SqliteDatabase');
