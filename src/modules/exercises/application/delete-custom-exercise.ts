import { createToken } from '@shared/application/di/token';
import type { Logger } from '@shared/application/logger';
import type { ExerciseId } from '@shared/domain/ids';
import { ok, type Result } from '@shared/domain/result';

import { archiveExercise, type CustomExercise } from '../domain/exercise';

import type { ExerciseReader, ExerciseWriter } from './exercise-repository';
import { findActiveExercise, logged } from './library-use-case-support';
import type { PhotoStore } from './photo-ports';
import { deletePhotosLogged } from './photo-cleanup';
import type { DeleteExerciseError } from './save-exercise-errors';

/**
 * Use case: deletes a custom exercise by **archiving** it (S1-21, decision Q1): `archiveExercise`
 * then `writer.saveCustom(archived, [])`. It disappears from the list, search, filters and detail,
 * stays readable by id with `includeArchived`, and its name becomes free again. Its photo files
 * are deleted right after the save (a failure is logged; orphan cleanup retries at a later start).
 * User-defined values it used stay. Unknown or already archived id → `exercises.notFound`;
 * built-in → `exercises.builtInReadOnly`. Never rejects.
 *
 * Phase 2: `createDeleteCustomExercise(deps: { reader; writer; photoStore; logger })`.
 */
export type DeleteCustomExercise = (id: ExerciseId) => Promise<Result<void, DeleteExerciseError>>;

export const DeleteCustomExerciseToken = createToken<DeleteCustomExercise>(
  'exercises.DeleteCustomExercise',
);

export interface DeleteCustomExerciseDependencies {
  readonly reader: ExerciseReader;
  readonly writer: ExerciseWriter;
  readonly photoStore: PhotoStore;
  readonly logger: Logger;
}

const NO_NEW_VALUES = Object.freeze([]);

async function archive(
  deps: DeleteCustomExerciseDependencies,
  id: ExerciseId,
): Promise<Result<CustomExercise, DeleteExerciseError>> {
  const exercise = await findActiveExercise(deps.reader, id);
  if (!exercise.ok) return exercise;
  const archived = archiveExercise(exercise.value);
  if (!archived.ok) return archived;
  const saved = await deps.writer.saveCustom(archived.value, NO_NEW_VALUES);
  return saved.ok ? archived : saved;
}

export function createDeleteCustomExercise(
  deps: DeleteCustomExerciseDependencies,
): DeleteCustomExercise {
  return async (id) => {
    const outcome = logged(
      deps.logger,
      'The exercise could not be deleted.',
      await archive(deps, id),
    );
    if (!outcome.ok) return outcome;
    await deletePhotosLogged(
      deps,
      outcome.value.images.map(({ fileName }) => fileName),
    );
    return ok(undefined);
  };
}
