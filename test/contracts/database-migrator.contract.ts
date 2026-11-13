import type { DatabaseMigrator } from '@shared/application/database-migrator';

import { unwrap } from '../support/unwrap';

import { defineContract } from './contract-harness';

/**
 * Contract every `DatabaseMigrator` must honour on a database it can open (S0-19). The subject
 * must have at least one pending migration, so the first run does real work.
 */
export const describeDatabaseMigratorContract = defineContract<DatabaseMigrator>(
  'DatabaseMigrator',
  (migrator) => {
    it('applies the pending migrations and reports the version change', async () => {
      const report = unwrap(await migrator().migrate());

      expect(report.applied.length).toBeGreaterThan(0);
      expect(report.toVersion - report.fromVersion).toBe(report.applied.length);
    });

    it('is idempotent: a second run applies nothing and keeps the version', async () => {
      const first = unwrap(await migrator().migrate());

      const second = unwrap(await migrator().migrate());

      expect(second).toEqual({
        fromVersion: first.toVersion,
        toVersion: first.toVersion,
        applied: [],
      });
    });
  },
);
