import type {
  BuiltInReadOnlyError,
  ExerciseNotFoundError,
  ExerciseValidationError,
} from '../domain/exercise-errors';

import type { ExerciseLibraryError } from './library-errors';

/**
 * Why saving a custom exercise failed (S1-19, S1-20). `exercises.invalidExercise` carries every
 * field issue, including `exercises.duplicateName`, so the form shows each next to its field.
 */
export type SaveExerciseError =
  ExerciseValidationError | ExerciseNotFoundError | BuiltInReadOnlyError | ExerciseLibraryError;

/** Why deleting (archiving) a custom exercise failed (S1-21). */
export type DeleteExerciseError =
  ExerciseNotFoundError | BuiltInReadOnlyError | ExerciseLibraryError;
