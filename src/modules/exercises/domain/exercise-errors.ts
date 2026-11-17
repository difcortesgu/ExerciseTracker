import type { DomainError } from '@shared/domain/domain-error';

/**
 * Error codes of the exercises domain (S1-08, S1-19 to S1-23, S1-29). The UI maps codes to text
 * (never matches messages); what it does with each code is listed in `docs/sprints/sprint-1.md`
 * "Interfaces → Error codes".
 */

/** Form fields an issue can be shown next to (S1-19: every problem next to its field). */
export type ExerciseField =
  | 'name'
  | 'category'
  | 'primaryMuscles'
  | 'secondaryMuscles'
  | 'equipment'
  | 'instructions'
  | 'photos'
  | 'trackedMetrics';

export type ExerciseFieldErrorCode =
  /** Blank after trimming. */
  | 'exercises.nameRequired'
  /** Longer than 80 characters after normalisation (`details.maximum`). */
  | 'exercises.nameTooLong'
  /** Equal (comparison key) to an active exercise's name; `details.existingName` (application). */
  | 'exercises.duplicateName'
  /** No category selected. */
  | 'exercises.categoryRequired'
  /** `existing` selection whose key is not in that vocabulary (`details.key`). */
  | 'exercises.unknownCategory'
  | 'exercises.unknownMuscle'
  | 'exercises.unknownEquipment'
  /** No primary muscle (assumption A3). */
  | 'exercises.primaryMuscleRequired'
  /** The same muscle is primary and secondary (`details.key`). */
  | 'exercises.muscleListedTwice'
  /** A new ("Add your own") value is blank. */
  | 'exercises.vocabularyValueRequired'
  /** A new value is longer than 40 characters (`details.maximum`). */
  | 'exercises.vocabularyValueTooLong'
  /** All steps together exceed 5 000 characters (assumption A6, `details.maximum`). */
  | 'exercises.instructionsTooLong'
  /** More than 6 photos (assumption A5, `details.maximum`). */
  | 'exercises.tooManyPhotos'
  /** No tracked metric selected. */
  | 'exercises.noTrackedMetric';

export interface ExerciseFieldIssue {
  readonly field: ExerciseField;
  readonly code: ExerciseFieldErrorCode;
  /** English fallback text for logs; the form shows its own text per code. */
  readonly message: string;
  /** e.g. `{ maximum: 80 }`, `{ key }`, `{ existingName }`, `{ index }` for list fields. */
  readonly details?: Readonly<Record<string, unknown>>;
}

/** Every field problem of a draft at once (S1-08 "all field errors together"). */
export interface ExerciseValidationError extends DomainError<'exercises.invalidExercise'> {
  readonly issues: readonly ExerciseFieldIssue[];
}

/** A new vocabulary value was rejected (S1-29, "Add your own" in a picker). */
export type VocabularyValueError = DomainError<
  'exercises.vocabularyValueRequired' | 'exercises.vocabularyValueTooLong'
>;

/** Built-ins are read-only (decision Q2): update, archive and delete are refused. */
export type BuiltInReadOnlyError = DomainError<'exercises.builtInReadOnly'>;

/** Unknown id, or archived where only active exercises are allowed (S1-15, S1-17). */
export type ExerciseNotFoundError = DomainError<'exercises.notFound'>;

/** A seed, image path or photo file name that does not satisfy its format (parse functions). */
export type InvalidExerciseDataError = DomainError<
  | 'exercises.invalidSeedSourceKey'
  | 'exercises.invalidDatasetImagePath'
  | 'exercises.invalidPhotoFileName'
>;
