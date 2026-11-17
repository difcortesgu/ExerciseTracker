import { and, asc, eq, ne } from 'drizzle-orm';

import type { ExerciseId } from '@shared/domain/ids';
import { map, ok } from '@shared/domain/result';
import type { SqliteDatabase } from '@shared/infrastructure/db/sqlite-database';

import type { ExerciseReader, FindExerciseOptions } from '../application/exercise-repository';
import type { ComparisonKey } from '../domain/comparison-key';
import type { Exercise, PhotoFileName } from '../domain/exercise';
import type { ExerciseSummary } from '../domain/exercise-summary';

import { exerciseFromRow, photoFileNamesFromColumn, summaryFromRow } from './exercise-row-mapper';
import { exercises } from './exercises.schema';
import { decodeRows, runStorage, type Stored } from './sqlite-storage';

/** The only columns a library summary reads (S1-14: lightweight list rows). */
const SUMMARY_COLUMNS = {
  id: exercises.id,
  name: exercises.name,
  origin: exercises.origin,
  category: exercises.category,
  primaryMuscles: exercises.primaryMuscles,
  equipment: exercises.equipment,
  images: exercises.images,
};

const isActive = eq(exercises.archived, false);

/**
 * Adapter (Repository): `ExerciseReader` on SQLite (S1-14). Rows are decoded by the row mapper;
 * a corrupt row or a driver failure is `exercises.storageFailed`.
 */
export class SqliteExerciseReader implements ExerciseReader {
  constructor(private readonly database: SqliteDatabase) {}

  listActiveSummaries(): Stored<readonly ExerciseSummary[]> {
    return runStorage(() =>
      decodeRows(
        this.database.select(SUMMARY_COLUMNS).from(exercises).where(isActive).all(),
        summaryFromRow,
      ),
    );
  }

  findById(id: ExerciseId, options?: FindExerciseOptions): Stored<Exercise | null> {
    return runStorage(() => {
      const row = this.database.select().from(exercises).where(eq(exercises.id, id)).get();
      if (row === undefined) return ok(null);
      return row.archived && options?.includeArchived !== true ? ok(null) : exerciseFromRow(row);
    });
  }

  /** Several active exercises may share a key (a re-seed, T9): the lowest id wins, stably. */
  findActiveByNameKey(
    nameKey: ComparisonKey,
    excluding?: ExerciseId,
  ): Stored<ExerciseSummary | null> {
    return runStorage(() => {
      const row = this.database
        .select(SUMMARY_COLUMNS)
        .from(exercises)
        .where(
          and(
            eq(exercises.nameKey, nameKey),
            isActive,
            excluding === undefined ? undefined : ne(exercises.id, excluding),
          ),
        )
        .orderBy(asc(exercises.id))
        .get();
      return row === undefined ? ok(null) : summaryFromRow(row);
    });
  }

  listActivePhotoFileNames(): Stored<ReadonlySet<PhotoFileName>> {
    return runStorage(() => {
      const rows = this.database
        .select({ images: exercises.images })
        .from(exercises)
        .where(and(eq(exercises.origin, 'custom'), isActive))
        .all();
      return map(
        decodeRows(rows, ({ images }) => photoFileNamesFromColumn(images)),
        (perExercise): ReadonlySet<PhotoFileName> => new Set(perExercise.flat()),
      );
    });
  }
}
