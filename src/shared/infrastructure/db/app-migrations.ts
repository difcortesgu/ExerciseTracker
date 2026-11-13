import type { Migration } from './migration';

/**
 * The app's schema migrations, in version order (ADR-001 "Database migrations in Expo Go").
 *
 * Sprint 0 has no tables yet, and drizzle-kit only writes a migrations index once a schema file
 * exists. When the first `*.schema.ts` is added, `npm run db:generate` writes
 * `./migrations/migrations.js`, and this constant becomes
 * `migrationsFromDrizzleKit(generatedMigrations)` (see drizzle-kit-migrations.ts).
 */
export const APP_MIGRATIONS: readonly Migration[] = [];
