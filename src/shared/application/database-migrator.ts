import type { DomainError } from '@shared/domain/domain-error';
import type { Result } from '@shared/domain/result';

import { createToken } from './di/token';

/** What a migration run did. Versions count applied migrations; 0 is an empty database. */
export interface MigrationReport {
  readonly fromVersion: number;
  readonly toVersion: number;
  /** Names of the migrations applied in this run, in order. Empty when already up to date. */
  readonly applied: readonly string[];
}

export type MigrationError = DomainError<'db.openFailed' | 'db.migrationFailed'>;

/**
 * Port: opens the local database and brings its schema up to date. Applies only pending
 * migrations, in order, each atomically; running it again on an up-to-date database changes
 * nothing. Expected failures are returned as `err`, never thrown or rejected.
 */
export interface DatabaseMigrator {
  migrate(): Promise<Result<MigrationReport, MigrationError>>;
}

export const DatabaseMigratorToken = createToken<DatabaseMigrator>('shared.DatabaseMigrator');
