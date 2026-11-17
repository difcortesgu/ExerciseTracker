import { createToken } from '@shared/application/di/token';
import type { DomainError } from '@shared/domain/domain-error';
import type { ExerciseId } from '@shared/domain/ids';
import type { Result } from '@shared/domain/result';

import type { ComparisonKey } from '../domain/comparison-key';
import type { BuiltInImage, CustomExercise, Exercise, PhotoFileName } from '../domain/exercise';
import type { ExerciseSummary } from '../domain/exercise-summary';
import type { VocabularyValue } from '../domain/vocabulary';

/**
 * Repository ports of the exercise library (S1-14, S1-19 to S1-22, S1-28, S1-29), split by
 * consumer (Interface Segregation): browsing reads, custom-exercise writes, vocabulary reads and
 * the built-in image catalogue. One SQLite adapter class may implement several of them; the
 * in-memory fakes and the SQLite adapter pass the **same** contract suites (Liskov).
 *
 * Contract common to every method: never throws or rejects; any storage failure is
 * `err(exercises.storageFailed)` with `details.cause`. Rows are mapped to domain values by explicit
 * mappers (Data Mapper); lists keep their order and tracked metrics their canonical order.
 */
export type ExerciseStorageError = DomainError<'exercises.storageFailed'>;

export interface FindExerciseOptions {
  /** Also return an archived exercise (marked `archived: true`). Routines/history need this later. */
  readonly includeArchived: boolean;
}

/** Port: reads for browsing, detail, editing and name uniqueness. */
export interface ExerciseReader {
  /** Every active (not archived) exercise, built-in and custom, as a summary; any order. */
  listActiveSummaries(): Promise<Result<readonly ExerciseSummary[], ExerciseStorageError>>;
  /**
   * The full exercise, or `null` when the id is unknown — or archived, unless
   * `options.includeArchived` is `true`.
   */
  findById(
    id: ExerciseId,
    options?: FindExerciseOptions,
  ): Promise<Result<Exercise | null, ExerciseStorageError>>;
  /**
   * An **active** exercise (built-in or custom) whose name has this comparison key, ignoring the
   * exercise `excluding` (so an exercise never collides with itself, S1-20); `null` if none.
   * Archived exercises never match (decision Q6). Backed by an indexed `name_key` column.
   */
  findActiveByNameKey(
    nameKey: ComparisonKey,
    excluding?: ExerciseId,
  ): Promise<Result<ExerciseSummary | null, ExerciseStorageError>>;
  /** Photo files referenced by active custom exercises (orphan cleanup and discard safety, S1-22). */
  listActivePhotoFileNames(): Promise<Result<ReadonlySet<PhotoFileName>, ExerciseStorageError>>;
}

export const ExerciseReaderToken = createToken<ExerciseReader>('exercises.ExerciseReader');

/** Port: writes of custom exercises (create, edit, archive). Built-ins are written by seeding only. */
export interface ExerciseWriter {
  /**
   * Inserts the custom exercise, or replaces the stored one with the same id, **and** inserts the
   * given new user-defined vocabulary values, in **one transaction** (S1-29: a value exists only
   * once an exercise using it was saved). Inserting a value that already exists with the same
   * `(kind, key, origin)` is a no-op. Archiving is a save with `archived: true`.
   */
  saveCustom(
    exercise: CustomExercise,
    newVocabularyValues: readonly VocabularyValue[],
  ): Promise<Result<void, ExerciseStorageError>>;
}

export const ExerciseWriterToken = createToken<ExerciseWriter>('exercises.ExerciseWriter');

/** Port: the stored vocabulary values (built-in and user-defined). */
export interface VocabularyReader {
  /**
   * Every stored value of every kind and origin, **unmerged** (a key may appear once per origin);
   * the domain's `mergeVocabulary` decides what is shown. User-defined values stay even when no
   * active exercise uses them (S1-29).
   */
  listValues(): Promise<Result<readonly VocabularyValue[], ExerciseStorageError>>;
}

export const VocabularyReaderToken = createToken<VocabularyReader>('exercises.VocabularyReader');

/** Port: the images of active built-ins, for the bulk download (S1-28). */
export interface BuiltInImageCatalog {
  /** Every image of every active built-in, each path once, in a stable order. */
  listActiveBuiltInImages(): Promise<Result<readonly BuiltInImage[], ExerciseStorageError>>;
}

export const BuiltInImageCatalogToken = createToken<BuiltInImageCatalog>(
  'exercises.BuiltInImageCatalog',
);
