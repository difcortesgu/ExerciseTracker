import { createToken } from '@shared/application/di/token';
import type { Logger } from '@shared/application/logger';
import type { ExerciseId } from '@shared/domain/ids';
import { ok, type Result } from '@shared/domain/result';

import {
  requireCustomExercise,
  reviseCustomExercise,
  type CustomExercise,
} from '../domain/exercise';

import type { EnsureLibrarySeeded } from './ensure-library-seeded';
import type { ExerciseInput } from './exercise-dtos';
import type { ExerciseReader, ExerciseWriter, VocabularyReader } from './exercise-repository';
import { findActiveExercise, logged } from './library-use-case-support';
import type { PhotoStore } from './photo-ports';
import { deletePhotosLogged } from './photo-cleanup';
import type { SaveExerciseError } from './save-exercise-errors';
import { validateExerciseInput } from './validate-exercise-input';

/**
 * Use case: edits a custom exercise (S1-20, S1-22). Same validation and uniqueness rules as create,
 * with the exercise itself excluded from the name check (renaming "my goblet squat" to
 * "My Goblet Squat" is accepted). Unknown or archived id → `exercises.notFound`; a built-in id →
 * `exercises.builtInReadOnly` (from the domain's `updateCustomExercise`). The id never changes.
 *
 * After a successful save, photos that were removed in the form are deleted from the photo store
 * (a deletion failure is logged only; the orphan cleanup removes the file at a later start).
 * Changing tracked metrics changes only the definition (no logs exist yet; Sprint 3/4 keep past
 * logs unchanged, ADR-004). Never rejects.
 *
 * Phase 2: `createUpdateCustomExercise(deps: { ensureLibrarySeeded; reader; writer;
 * vocabularyReader; photoStore: PhotoStore; logger })`.
 */
export type UpdateCustomExercise = (
  id: ExerciseId,
  input: ExerciseInput,
) => Promise<Result<void, SaveExerciseError>>;

export const UpdateCustomExerciseToken = createToken<UpdateCustomExercise>(
  'exercises.UpdateCustomExercise',
);

export interface UpdateCustomExerciseDependencies {
  readonly ensureLibrarySeeded: EnsureLibrarySeeded;
  readonly reader: ExerciseReader;
  readonly writer: ExerciseWriter;
  readonly vocabularyReader: VocabularyReader;
  readonly photoStore: PhotoStore;
  readonly logger: Logger;
}

/** The saved exercise and the one it replaced (for removed-photo cleanup). */
interface Replacement {
  readonly previous: CustomExercise;
  readonly next: CustomExercise;
}

async function update(
  deps: UpdateCustomExerciseDependencies,
  id: ExerciseId,
  input: ExerciseInput,
): Promise<Result<Replacement, SaveExerciseError>> {
  const seeded = await deps.ensureLibrarySeeded();
  if (!seeded.ok) return seeded;
  const found = await findActiveExercise(deps.reader, id);
  if (!found.ok) return found;
  const previous = requireCustomExercise(found.value);
  if (!previous.ok) return previous;
  const validated = await validateExerciseInput(deps, input, id);
  if (!validated.ok) return validated;
  const next = reviseCustomExercise(previous.value, validated.value);
  const saved = await deps.writer.saveCustom(next, validated.value.newVocabularyValues);
  return saved.ok ? ok({ previous: previous.value, next }) : saved;
}

function removedPhotos({ previous, next }: Replacement) {
  const kept = new Set(next.images.map(({ fileName }) => fileName));
  return previous.images.map(({ fileName }) => fileName).filter((fileName) => !kept.has(fileName));
}

export function createUpdateCustomExercise(
  deps: UpdateCustomExerciseDependencies,
): UpdateCustomExercise {
  return async (id, input) => {
    const outcome = logged(
      deps.logger,
      'The exercise could not be saved.',
      await update(deps, id, input),
    );
    if (!outcome.ok) return outcome;
    await deletePhotosLogged(deps, removedPhotos(outcome.value));
    return ok(undefined);
  };
}
