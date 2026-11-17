import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import type { ExerciseId } from '@shared/domain/ids';
import { ok } from '@shared/domain/result';
import type { SqliteDatabase } from '@shared/infrastructure/db/sqlite-database';

import type { BuiltInLibraryStore } from '../application/library-seed-ports';
import type { BuiltInExercise } from '../domain/exercise';
import type { LibrarySeedPlan } from '../domain/library-seed';

import { builtInExerciseFromRow, exerciseToRow } from './exercise-row-mapper';
import { exerciseLibrarySeed, exercises, exerciseVocabularyValues } from './exercises.schema';
import { decodeRows, inBatches, runStorage, type Stored } from './sqlite-storage';
import { vocabularyValueToRow } from './vocabulary-row-mapper';

/** The single row of `exercise_library_seed`. */
const SEED_ROW_ID = 1;

/**
 * Rows per multi-row statement. 50 rows × 16 columns = 800 bound parameters, below SQLite's
 * historical 999-parameter limit, so the seed works with any SQLite build (ADR-004: ≤ 100).
 */
export const SEED_BATCH_SIZE = 50;

type Transaction = Parameters<Parameters<SqliteDatabase['transaction']>[0]>[0];

const isBuiltIn = eq(exercises.origin, 'builtIn');

/**
 * Adapter (Repository, Unit of Work in one method): `BuiltInLibraryStore` on SQLite (S1-12).
 * `applySeed` writes the whole plan **and** the seed version in one transaction, in bounded
 * batches; any failure rolls everything back. Every statement is restricted to built-in rows, so
 * custom exercises and user-defined values are never touched.
 */
export class SqliteBuiltInLibraryStore implements BuiltInLibraryStore {
  constructor(private readonly database: SqliteDatabase) {}

  readSeedVersion(): Stored<number | null> {
    return runStorage(() => {
      const row = this.database
        .select({ seedVersion: exerciseLibrarySeed.seedVersion })
        .from(exerciseLibrarySeed)
        .where(eq(exerciseLibrarySeed.id, SEED_ROW_ID))
        .get();
      return ok(row?.seedVersion ?? null);
    });
  }

  listBuiltIns(): Stored<readonly BuiltInExercise[]> {
    return runStorage(() =>
      decodeRows(
        this.database.select().from(exercises).where(isBuiltIn).orderBy(asc(exercises.id)).all(),
        builtInExerciseFromRow,
      ),
    );
  }

  applySeed(plan: LibrarySeedPlan): Stored<void> {
    return runStorage(() => {
      this.database.transaction((transaction) => {
        insertBuiltIns(transaction, plan.insert);
        updateBuiltIns(transaction, plan.update);
        archiveBuiltIns(transaction, plan.archive);
        upsertBuiltInVocabulary(transaction, plan);
        recordSeedVersion(transaction, plan.seedVersion);
      });
      return ok(undefined);
    });
  }
}

function insertBuiltIns(transaction: Transaction, insert: readonly BuiltInExercise[]): void {
  inBatches(insert, SEED_BATCH_SIZE).forEach((batch) =>
    transaction.insert(exercises).values(batch.map(exerciseToRow)).run(),
  );
}

function updateBuiltIns(transaction: Transaction, update: readonly BuiltInExercise[]): void {
  update.forEach((exercise) =>
    transaction
      .update(exercises)
      .set(exerciseToRow(exercise))
      .where(and(eq(exercises.id, exercise.id), isBuiltIn))
      .run(),
  );
}

function archiveBuiltIns(transaction: Transaction, archive: readonly ExerciseId[]): void {
  inBatches(archive, SEED_BATCH_SIZE).forEach((batch) =>
    transaction
      .update(exercises)
      .set({ archived: true })
      .where(and(inArray(exercises.id, [...batch]), isBuiltIn))
      .run(),
  );
}

/** Built-in values are upserted by `(kind, key, origin)`; their label follows the seed. */
function upsertBuiltInVocabulary(transaction: Transaction, plan: LibrarySeedPlan): void {
  inBatches(plan.vocabulary, SEED_BATCH_SIZE).forEach((batch) =>
    transaction
      .insert(exerciseVocabularyValues)
      .values(batch.map(vocabularyValueToRow))
      .onConflictDoUpdate({
        target: [
          exerciseVocabularyValues.kind,
          exerciseVocabularyValues.key,
          exerciseVocabularyValues.origin,
        ],
        set: { label: sql`excluded.label` },
      })
      .run(),
  );
}

function recordSeedVersion(transaction: Transaction, seedVersion: number): void {
  transaction
    .insert(exerciseLibrarySeed)
    .values({ id: SEED_ROW_ID, seedVersion })
    .onConflictDoUpdate({ target: exerciseLibrarySeed.id, set: { seedVersion } })
    .run();
}
