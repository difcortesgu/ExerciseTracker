import { domainError } from '@shared/domain/domain-error';
import { describeDatabaseMigratorContract } from '@test/contracts/database-migrator.contract';

import { unwrap, unwrapErr } from '../support/unwrap';

import { FakeDatabaseMigrator } from './fake-database-migrator';

describeDatabaseMigratorContract(
  'FakeDatabaseMigrator',
  () => new FakeDatabaseMigrator(['0000_init', '0001_add_notes']),
);

describe('FakeDatabaseMigrator', () => {
  it('applies the configured pending migrations in order', async () => {
    const migrator = new FakeDatabaseMigrator(['0000_init', '0001_add_notes']);

    expect(unwrap(await migrator.migrate())).toEqual({
      fromVersion: 0,
      toVersion: 2,
      applied: ['0000_init', '0001_add_notes'],
    });
  });

  it('is up to date by default', async () => {
    expect(unwrap(await new FakeDatabaseMigrator().migrate())).toEqual({
      fromVersion: 0,
      toVersion: 0,
      applied: [],
    });
  });

  it('returns the configured failure and counts its runs', async () => {
    const failure = domainError('db.migrationFailed', 'Migration 0001 failed');
    const migrator = FakeDatabaseMigrator.failingWith(failure);

    expect(unwrapErr(await migrator.migrate())).toBe(failure);
    expect(migrator.runs).toBe(1);
  });
});
