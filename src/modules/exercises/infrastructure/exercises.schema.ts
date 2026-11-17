import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Tables owned by the exercises module (S1-04, ADR-004 §2). Persistence models only: the row
 * mappers next to the adapters translate rows to domain values and back (Data Mapper); these
 * Drizzle types never leave infrastructure.
 *
 * List fields are JSON text columns (search and filters run in memory, a whole exercise is one
 * row written atomically). There is deliberately **no** unique constraint on names (T9).
 * Changing a table means a new `npm run db:generate` migration; shipped migrations are never edited.
 */
export const exercises = sqliteTable(
  'exercises',
  {
    id: text('id').primaryKey(),
    /** `builtIn` or `custom`. */
    origin: text('origin').notNull(),
    /** Upstream dataset id of a built-in; `null` for custom exercises. */
    sourceKey: text('source_key').unique('exercises_source_key_unique'),
    name: text('name').notNull(),
    /** `comparisonKey(name)`, written on every save (name uniqueness lookup, Q6). */
    nameKey: text('name_key').notNull(),
    category: text('category').notNull(),
    equipment: text('equipment'),
    level: text('level'),
    force: text('force'),
    mechanic: text('mechanic'),
    /** JSON array of vocabulary keys. */
    primaryMuscles: text('primary_muscles').notNull(),
    /** JSON array of vocabulary keys. */
    secondaryMuscles: text('secondary_muscles').notNull(),
    /** JSON array of steps. */
    instructions: text('instructions').notNull(),
    /** JSON array: `{ path, sizeBytes }` for built-ins, photo file names for custom exercises. */
    images: text('images').notNull(),
    /** JSON array of tracked metrics in canonical order. */
    trackedMetrics: text('tracked_metrics').notNull(),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [
    index('exercises_name_key_idx').on(table.nameKey),
    index('exercises_archived_idx').on(table.archived),
  ],
);

/** Built-in and user-defined vocabulary values; equal keys of both origins coexist (T7, T9). */
export const exerciseVocabularyValues = sqliteTable(
  'exercise_vocabulary_values',
  {
    kind: text('kind').notNull(),
    key: text('key').notNull(),
    origin: text('origin').notNull(),
    label: text('label').notNull(),
  },
  (table) => [primaryKey({ columns: [table.kind, table.key, table.origin] })],
);

/** Single row (`id` always 1): the seed version applied last (S1-12). */
export const exerciseLibrarySeed = sqliteTable('exercise_library_seed', {
  id: integer('id').primaryKey(),
  seedVersion: integer('seed_version').notNull(),
});

export type ExerciseRow = typeof exercises.$inferSelect;
export type VocabularyValueRow = typeof exerciseVocabularyValues.$inferSelect;
