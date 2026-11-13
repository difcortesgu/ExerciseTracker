import type {
  DatabaseMigrator,
  MigrationError,
  MigrationReport,
} from '@shared/application/database-migrator';
import { err, ok, type Result } from '@shared/domain/result';

/**
 * Fake `DatabaseMigrator`: applies a configured list of migration names once, or always fails
 * with a configured error. Counts its runs.
 */
export class FakeDatabaseMigrator implements DatabaseMigrator {
  private version = 0;
  private runCount = 0;
  private failure: MigrationError | undefined;

  constructor(private readonly migrationNames: readonly string[] = []) {}

  static failingWith(failure: MigrationError): FakeDatabaseMigrator {
    const migrator = new FakeDatabaseMigrator();
    migrator.failure = failure;
    return migrator;
  }

  get runs(): number {
    return this.runCount;
  }

  async migrate(): Promise<Result<MigrationReport, MigrationError>> {
    this.runCount += 1;
    if (this.failure !== undefined) {
      return err(this.failure);
    }
    const fromVersion = this.version;
    this.version = this.migrationNames.length;
    return ok({
      fromVersion,
      toVersion: this.version,
      applied: this.migrationNames.slice(fromVersion),
    });
  }
}
