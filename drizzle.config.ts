/**
 * drizzle-kit configuration (ADR-001 "Migrations").
 * `npm run db:generate` writes versioned SQL migrations plus a `migrations.js` index that imports
 * them; babel-plugin-inline-import inlines the .sql files so the bundle works in Expo Go and Jest.
 * Each module owns its tables in `src/modules/<module>/infrastructure/**\/*.schema.ts`.
 */
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: [
    './src/shared/infrastructure/db/**/*.schema.ts',
    './src/modules/*/infrastructure/**/*.schema.ts',
  ],
  out: './src/shared/infrastructure/db/migrations',
});
