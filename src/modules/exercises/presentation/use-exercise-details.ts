import { useCallback, useState } from 'react';

import { useDependency } from '@core/presentation';
import { domainError } from '@shared/domain/domain-error';
import { parseExerciseId, type ExerciseId } from '@shared/domain/ids';
import { err, type Result } from '@shared/domain/result';

import type { ExerciseNotFoundError } from '../domain/exercise-errors';
import { DeleteCustomExerciseToken } from '../application/delete-custom-exercise';
import type { ExerciseDetails } from '../application/exercise-dtos';
import { GetExerciseDetailsToken } from '../application/get-exercise-details';
import type { ExerciseLookupError } from '../application/library-errors';
import type { DeleteExerciseError } from '../application/save-exercise-errors';

import { useResultLoader, type LoadState } from './use-result-loader';

/** What a route param holds: one string, several (repeated param) or nothing. */
export type RouteParam = string | readonly string[] | undefined;

export type DeleteState =
  | { readonly status: 'idle' }
  | { readonly status: 'deleting' }
  | { readonly status: 'failed'; readonly error: DeleteExerciseError };

export interface ExerciseDetailsViewModel {
  readonly details: LoadState<ExerciseDetails, ExerciseLookupError>;
  readonly reload: () => void;
  readonly deletion: DeleteState;
  /** Archives the exercise (S1-21); resolves `true` once it is gone. */
  readonly deleteExercise: () => Promise<boolean>;
}

const IDLE: DeleteState = Object.freeze({ status: 'idle' });

/** A stale or malformed link is simply "not found" (S1-17), never a crash. */
export function exerciseIdFromParam(param: RouteParam): Result<ExerciseId, ExerciseNotFoundError> {
  const parsed = typeof param === 'string' ? parseExerciseId(param) : null;
  return parsed?.ok === true
    ? parsed
    : err(domainError('exercises.notFound', 'The link does not name an exercise.'));
}

/**
 * View-model hook (MVVM) of the detail screen (S1-17, S1-21): loads the exercise through
 * `GetExerciseDetails` and deletes (archives) a custom one through `DeleteCustomExercise`.
 */
export function useExerciseDetails(idParam: RouteParam): ExerciseDetailsViewModel {
  const getExerciseDetails = useDependency(GetExerciseDetailsToken);
  const deleteCustomExercise = useDependency(DeleteCustomExerciseToken);
  const [deletion, setDeletion] = useState<DeleteState>(IDLE);
  const id = exerciseIdFromParam(idParam);
  const idValue = id.ok ? id.value : null;

  const load = useCallback(
    (): Promise<Result<ExerciseDetails, ExerciseLookupError>> =>
      idValue === null
        ? Promise.resolve(err(domainError('exercises.notFound', 'No exercise id.')))
        : getExerciseDetails(idValue),
    [getExerciseDetails, idValue],
  );
  const { state, reload } = useResultLoader(load);

  const deleteExercise = useCallback(async (): Promise<boolean> => {
    if (idValue === null) {
      return false;
    }
    setDeletion({ status: 'deleting' });
    const result = await deleteCustomExercise(idValue);
    setDeletion(result.ok ? IDLE : { status: 'failed', error: result.error });
    return result.ok;
  }, [deleteCustomExercise, idValue]);

  return { details: state, reload, deletion, deleteExercise };
}
