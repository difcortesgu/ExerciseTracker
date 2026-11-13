import type { Migration } from './migration';

/** drizzle-kit's separator between statements in a generated `.sql` migration. */
const STATEMENT_BREAKPOINT = '--> statement-breakpoint';
const JOURNAL_KEY_DIGITS = 4;

/** Shape of the `migrations.js` index that `npm run db:generate` writes (driver: expo). */
export interface DrizzleKitMigrationBundle {
  readonly journal: { readonly entries: readonly { readonly idx: number; readonly tag: string }[] };
  readonly migrations: Readonly<Record<string, string>>;
}

function splitStatements(migrationSql: string): readonly string[] {
  return migrationSql
    .split(STATEMENT_BREAKPOINT)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

/**
 * Adapter from the drizzle-kit generated bundle (journal + inlined SQL) to the runner's ordered
 * `Migration[]`. A journal entry without SQL means a broken build artefact: programmer error.
 */
export function migrationsFromDrizzleKit(bundle: DrizzleKitMigrationBundle): readonly Migration[] {
  return [...bundle.journal.entries]
    .sort((first, second) => first.idx - second.idx)
    .map(({ idx, tag }) => {
      const migrationSql = bundle.migrations[`m${String(idx).padStart(JOURNAL_KEY_DIGITS, '0')}`];
      if (migrationSql === undefined) {
        throw new Error(`The generated migrations index has no SQL for "${tag}".`);
      }
      return { version: idx + 1, name: tag, statements: splitStatements(migrationSql) };
    });
}
