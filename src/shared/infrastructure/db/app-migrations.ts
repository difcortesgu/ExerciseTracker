import { migrationsFromDrizzleKit } from './drizzle-kit-migrations';
import type { Migration } from './migration';
import generatedMigrations from './migrations/migrations';

/**
 * The app's schema migrations, in version order (ADR-001 "Database migrations in Expo Go", S1-04).
 *
 * Built from the index that `npm run db:generate` writes from every `*.schema.ts` (journal plus
 * the SQL inlined by babel-plugin-inline-import), so the bundle is the single source of truth and a
 * broken bundle fails the composition-root test. Never edit a generated migration that has shipped.
 */
export const APP_MIGRATIONS: readonly Migration[] = migrationsFromDrizzleKit(generatedMigrations);
