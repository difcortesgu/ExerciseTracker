import type { Logger } from '@shared/application/logger';
import { domainError, type DomainError } from '@shared/domain/domain-error';
import type { IdGenerator } from '@shared/application/id-generator';
import { parseExerciseId, type ExerciseId } from '@shared/domain/ids';
import { err, map, ok, type Result } from '@shared/domain/result';

import type { Exercise } from '../domain/exercise';
import type { ExerciseNotFoundError } from '../domain/exercise-errors';
import { mergeVocabulary, type Vocabulary } from '../domain/vocabulary';

import type { ExerciseReader, ExerciseStorageError, VocabularyReader } from './exercise-repository';

/**
 * Helpers shared by the exercises use cases (DRY: every library use case logs its failures the
 * same way and reads the merged vocabulary the same way).
 */

/** Expected, user-facing outcomes logged at `info` instead of `warn` (stale links, not faults). */
const INFO_LEVEL_CODES: ReadonlySet<string> = new Set(['exercises.notFound']);

/** The user's own input or choice (shown in the UI): not a fault, never logged. */
const UNLOGGED_CODES: ReadonlySet<string> = new Set([
  'exercises.invalidExercise',
  'exercises.photoPermissionDenied',
]);

/**
 * Logs a failed result with its code (`warn`, or `info` for `exercises.notFound`; validation
 * issues and denied permissions are not logged) and returns the result unchanged, so a use case can end with `return logged(logger, message, outcome)`.
 */
export function logged<T, E extends DomainError>(
  logger: Logger,
  message: string,
  outcome: Result<T, E>,
): Result<T, E> {
  if (!outcome.ok && !UNLOGGED_CODES.has(outcome.error.code)) {
    const context = { code: outcome.error.code, details: outcome.error.details };
    if (INFO_LEVEL_CODES.has(outcome.error.code)) logger.info(message, context);
    else logger.warn(message, context);
  }
  return outcome;
}

/** Every stored vocabulary value, merged for display by the domain (`mergeVocabulary`). */
export async function loadVocabulary(
  reader: VocabularyReader,
): Promise<Result<Vocabulary, ExerciseStorageError>> {
  return map(await reader.listValues(), mergeVocabulary);
}

/** Unknown id, or archived where only active exercises count (S1-15, S1-17, S1-21). */
export function exerciseNotFound(id: ExerciseId): ExerciseNotFoundError {
  return domainError('exercises.notFound', 'The exercise does not exist.', { id });
}

/** The active exercise with this id, or `exercises.notFound` (unknown or archived). */
export async function findActiveExercise(
  reader: ExerciseReader,
  id: ExerciseId,
): Promise<Result<Exercise, ExerciseStorageError | ExerciseNotFoundError>> {
  const found = await reader.findById(id);
  if (!found.ok) return found;
  return found.value === null ? err(exerciseNotFound(id)) : ok(found.value);
}

/** A new exercise id; a blank id from the generator breaks its contract (programmer error). */
export function nextExerciseId(idGenerator: IdGenerator): ExerciseId {
  const id = parseExerciseId(idGenerator.next());
  if (!id.ok) throw new Error('The IdGenerator returned a blank exercise id.');
  return id.value;
}
