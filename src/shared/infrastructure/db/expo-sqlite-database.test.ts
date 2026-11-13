import { openDatabaseSync } from 'expo-sqlite';

import { openExpoSqliteDatabase } from './expo-sqlite-database';

// Native module boundary: expo-sqlite needs the device's SQLite, which Jest does not have.
// Real SQL behaviour is covered by the same adapters running on better-sqlite3 (ADR-001).
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({ nativeDatabase: 'mock' })),
}));

describe('openExpoSqliteDatabase', () => {
  it('opens the named database file through expo-sqlite', () => {
    openExpoSqliteDatabase('exercise-tracker.db');

    expect(openDatabaseSync).toHaveBeenCalledWith('exercise-tracker.db');
  });

  it('wraps the native connection in a Drizzle database', () => {
    const database = openExpoSqliteDatabase('exercise-tracker.db');

    expect(typeof database.select).toBe('function');
    expect(typeof database.transaction).toBe('function');
  });
});
