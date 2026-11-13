import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import type { SqliteDatabase } from './sqlite-database';

/**
 * Opens the app's on-device SQLite database through expo-sqlite (works in Expo Go) and wraps it in
 * Drizzle (S0-18). Called only by the composition root; may throw if the file cannot be opened,
 * which the migrator reports as `db.openFailed`.
 */
export function openExpoSqliteDatabase(fileName: string): SqliteDatabase {
  return drizzle(openDatabaseSync(fileName));
}
