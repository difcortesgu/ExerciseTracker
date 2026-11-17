import { createToken } from '@shared/application/di/token';
import type { Logger } from '@shared/application/logger';
import type { ExerciseId } from '@shared/domain/ids';
import { ok, type Result } from '@shared/domain/result';

import { comparisonKey } from '../domain/comparison-key';
import { suggestDuplicateName } from '../domain/duplicate-name';

import type { EnsureLibrarySeeded } from './ensure-library-seeded';
import { toExerciseFormValues } from './exercise-dto-mappers';
import type { ExerciseFormValues } from './exercise-dtos';
import type { ExerciseReader, VocabularyReader } from './exercise-repository';
import type { ExerciseLookupError } from './library-errors';
import { findActiveExercise, loadVocabulary, logged } from './library-use-case-support';

/**
 * Use case: the create-form prefill for "Duplicate as custom" (S1-23, decision Q2). Copies name,
 * category, muscles, equipment, instructions and tracked metrics of an active exercise; **no
 * images or photos** (A10). The name is the domain's `suggestDuplicateName(name, takenKeys)`:
 * "<name> (custom)", then "(custom 2)", "(custom 3)" … — the first one free among the active
 * exercises' comparison keys, shortened to stay within 80 characters. Stores nothing; the name is
 * checked again on Save. Unknown or archived id → `exercises.notFound`. Never rejects.
 *
 * Phase 2: `suggestDuplicateName` in `exercises/domain` (property-tested) and
 * `createPrepareDuplicate(deps: { ensureLibrarySeeded; reader; vocabularyReader; logger })`.
 */
export type PrepareDuplicate = (
  id: ExerciseId,
) => Promise<Result<ExerciseFormValues, ExerciseLookupError>>;

export const PrepareDuplicateToken = createToken<PrepareDuplicate>('exercises.PrepareDuplicate');

export interface PrepareDuplicateDependencies {
  readonly ensureLibrarySeeded: EnsureLibrarySeeded;
  readonly reader: ExerciseReader;
  readonly vocabularyReader: VocabularyReader;
  readonly logger: Logger;
}

const NO_PHOTOS = Object.freeze([]);

async function prepare(
  deps: PrepareDuplicateDependencies,
  id: ExerciseId,
): Promise<Result<ExerciseFormValues, ExerciseLookupError>> {
  const seeded = await deps.ensureLibrarySeeded();
  if (!seeded.ok) return seeded;
  const exercise = await findActiveExercise(deps.reader, id);
  if (!exercise.ok) return exercise;
  const summaries = await deps.reader.listActiveSummaries();
  if (!summaries.ok) return summaries;
  const vocabulary = await loadVocabulary(deps.vocabularyReader);
  if (!vocabulary.ok) return vocabulary;
  const takenKeys = new Set(summaries.value.map(({ name }) => comparisonKey(name)));
  const prefill = toExerciseFormValues(exercise.value, vocabulary.value, NO_PHOTOS);
  return ok(
    Object.freeze({ ...prefill, name: suggestDuplicateName(exercise.value.name, takenKeys) }),
  );
}

export function createPrepareDuplicate(deps: PrepareDuplicateDependencies): PrepareDuplicate {
  return async (id) =>
    logged(deps.logger, 'The exercise could not be duplicated.', await prepare(deps, id));
}
