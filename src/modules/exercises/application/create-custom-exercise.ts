import { createToken } from '@shared/application/di/token';
import type { IdGenerator } from '@shared/application/id-generator';
import type { Logger } from '@shared/application/logger';
import type { ExerciseId } from '@shared/domain/ids';
import { ok, type Result } from '@shared/domain/result';

import { createCustomExercise } from '../domain/exercise';

import type { EnsureLibrarySeeded } from './ensure-library-seeded';
import type { ExerciseInput } from './exercise-dtos';
import type { ExerciseReader, ExerciseWriter, VocabularyReader } from './exercise-repository';
import { logged, nextExerciseId } from './library-use-case-support';
import type { SaveExerciseError } from './save-exercise-errors';
import { validateExerciseInput } from './validate-exercise-input';

/**
 * Use case: creates a custom exercise (S1-19, S1-23, S1-29) and returns its new id.
 *
 * 1. Awaits `EnsureLibrarySeeded`; loads the merged vocabulary.
 * 2. `validateExerciseDraft` (all field issues) **and** the uniqueness check
 *    `reader.findActiveByNameKey(comparisonKey(name))` against every active built-in and custom
 *    exercise (decision Q6); a conflict adds `exercises.duplicateName` with
 *    `details.existingName` to the same issue list. Enforced **only here and in update** — there
 *    is no database unique constraint on names (re-seeding may create equal names, T9).
 * 3. `createCustomExercise(idGenerator.next(), validated)` and `writer.saveCustom(exercise,
 *    validated.newVocabularyValues)` (one transaction).
 * Nothing is stored on any error. Never rejects; storage failures are logged.
 *
 * Phase 2: `createCreateCustomExercise(deps: { ensureLibrarySeeded; reader; writer;
 * vocabularyReader; idGenerator: IdGenerator; logger })`.
 */
export type CreateCustomExercise = (
  input: ExerciseInput,
) => Promise<Result<ExerciseId, SaveExerciseError>>;

export const CreateCustomExerciseToken = createToken<CreateCustomExercise>(
  'exercises.CreateCustomExercise',
);

export interface CreateCustomExerciseDependencies {
  readonly ensureLibrarySeeded: EnsureLibrarySeeded;
  readonly reader: ExerciseReader;
  readonly writer: ExerciseWriter;
  readonly vocabularyReader: VocabularyReader;
  readonly idGenerator: IdGenerator;
  readonly logger: Logger;
}

async function create(
  deps: CreateCustomExerciseDependencies,
  input: ExerciseInput,
): Promise<Result<ExerciseId, SaveExerciseError>> {
  const seeded = await deps.ensureLibrarySeeded();
  if (!seeded.ok) return seeded;
  const validated = await validateExerciseInput(deps, input);
  if (!validated.ok) return validated;
  const exercise = createCustomExercise(nextExerciseId(deps.idGenerator), validated.value);
  const saved = await deps.writer.saveCustom(exercise, validated.value.newVocabularyValues);
  return saved.ok ? ok(exercise.id) : saved;
}

export function createCreateCustomExercise(
  deps: CreateCustomExerciseDependencies,
): CreateCustomExercise {
  return async (input) =>
    logged(deps.logger, 'The exercise could not be created.', await create(deps, input));
}
