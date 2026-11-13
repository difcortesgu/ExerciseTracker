import { sql } from 'drizzle-orm';

import type {
  DatabaseMigrator,
  MigrationError,
  MigrationReport,
} from '@shared/application/database-migrator';
import { describeCause } from '@shared/domain/describe-cause';
import { domainError } from '@shared/domain/domain-error';
import { andThen, err, ok, type Result } from '@shared/domain/result';

import type { Migration } from './migration';
import type { SqliteDatabase } from './sqlite-database';

/** The runner's own bookkeeping table: one row per applied migration. */
const VERSION_TABLE = 'schema_migrations';
const EMPTY_DATABASE_VERSION = 0;
const CREATE_VERSION_TABLE = `CREATE TABLE IF NOT EXISTS ${VERSION_TABLE} (version INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL)`;

interface OpenedDatabase {
  readonly database: SqliteDatabase;
  readonly version: number;
}

type MigrationOutcome = Result<MigrationReport, MigrationError>;

export interface SqliteDatabaseMigratorOptions {
  /** Opens (or returns) the database; a throw is reported as `db.openFailed`. */
  readonly openDatabase: () => SqliteDatabase;
  readonly migrations: readonly Migration[];
}

function inVersionOrder(migrations: readonly Migration[]): readonly Migration[] {
  const ordered = [...migrations].sort((first, second) => first.version - second.version);
  ordered.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new Error(`Migrations must have versions 1..n without gaps; got "${migration.name}".`);
    }
  });
  return ordered;
}

/**
 * Adapter: the `DatabaseMigrator` port on SQLite (S0-19). Applies only pending migrations, in
 * version order, each in its own transaction together with its version row, so a failing migration
 * is rolled back completely and the recorded version stays at the last successful one.
 */
export class SqliteDatabaseMigrator implements DatabaseMigrator {
  private readonly migrations: readonly Migration[];

  constructor(private readonly options: SqliteDatabaseMigratorOptions) {
    this.migrations = inVersionOrder(options.migrations);
  }

  async migrate(): Promise<MigrationOutcome> {
    return andThen(this.open(), (opened) => this.applyPending(opened));
  }

  /** Opening includes the first read: a corrupt or unusable file only fails on its first query. */
  private open(): Result<OpenedDatabase, MigrationError> {
    try {
      const database = this.options.openDatabase();
      database.run(sql.raw(CREATE_VERSION_TABLE));
      return ok({ database, version: currentVersion(database) });
    } catch (cause) {
      return err(
        domainError('db.openFailed', 'The database could not be opened.', {
          cause: describeCause(cause),
        }),
      );
    }
  }

  /**
   * The reached version is counted, not re-read: versions are 1..n and each migration commits
   * atomically with its version row, so it is `fromVersion + applied.length`. Re-reading could
   * throw after a failure and make `migrate()` reject, which the port forbids.
   */
  private applyPending({ database, version: fromVersion }: OpenedDatabase): MigrationOutcome {
    const applied: string[] = [];
    for (const migration of this.migrations.filter(({ version }) => version > fromVersion)) {
      try {
        applyMigration(database, migration);
      } catch (cause) {
        return err(migrationFailed(migration, fromVersion, fromVersion + applied.length, cause));
      }
      applied.push(migration.name);
    }
    return ok({ fromVersion, toVersion: fromVersion + applied.length, applied });
  }
}

function currentVersion(database: SqliteDatabase): number {
  const row = database.get<{ readonly version: number | null }>(
    sql.raw(`SELECT MAX(version) AS version FROM ${VERSION_TABLE}`),
  );
  return row?.version ?? EMPTY_DATABASE_VERSION;
}

function applyMigration(database: SqliteDatabase, migration: Migration): void {
  database.transaction((transaction) => {
    migration.statements.forEach((statement) => transaction.run(sql.raw(statement)));
    transaction.run(
      sql`INSERT INTO ${sql.identifier(VERSION_TABLE)} (version, name) VALUES (${migration.version}, ${migration.name})`,
    );
  });
}

function migrationFailed(
  migration: Migration,
  fromVersion: number,
  reachedVersion: number,
  cause: unknown,
): MigrationError {
  return domainError('db.migrationFailed', `Database migration "${migration.name}" failed.`, {
    migration: migration.name,
    fromVersion,
    reachedVersion,
    cause: describeCause(cause),
  });
}
