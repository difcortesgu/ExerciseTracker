import { createToken } from '@shared/application/di/token';
import type { Logger } from '@shared/application/logger';
import type { ExerciseId } from '@shared/domain/ids';
import { ok, type Result } from '@shared/domain/result';

import type { EnsureLibrarySeeded } from './ensure-library-seeded';
import { toExerciseDetails } from './exercise-dto-mappers';
import type { ExerciseDetails } from './exercise-dtos';
import type { ExerciseReader, VocabularyReader } from './exercise-repository';
import type { ExerciseLookupError } from './library-errors';
import { findActiveExercise, loadVocabulary, logged } from './library-use-case-support';

/**
 * Use case: one active exercise for the detail screen (S1-15, S1-17). Unknown or archived id →
 * `exercises.notFound` ("Exercise not found" state). Awaits `EnsureLibrarySeeded`. Never rejects.
 *
 * Phase 2: `createGetExerciseDetails(deps: { ensureLibrarySeeded; reader; vocabularyReader;
 * logger }): GetExerciseDetails`.
 */
export type GetExerciseDetails = (
  id: ExerciseId,
) => Promise<Result<ExerciseDetails, ExerciseLookupError>>;

export const GetExerciseDetailsToken = createToken<GetExerciseDetails>(
  'exercises.GetExerciseDetails',
);

export interface GetExerciseDetailsDependencies {
  readonly ensureLibrarySeeded: EnsureLibrarySeeded;
  readonly reader: ExerciseReader;
  readonly vocabularyReader: VocabularyReader;
  readonly logger: Logger;
}

async function details(
  deps: GetExerciseDetailsDependencies,
  id: ExerciseId,
): Promise<Result<ExerciseDetails, ExerciseLookupError>> {
  const seeded = await deps.ensureLibrarySeeded();
  if (!seeded.ok) return seeded;
  const exercise = await findActiveExercise(deps.reader, id);
  if (!exercise.ok) return exercise;
  const vocabulary = await loadVocabulary(deps.vocabularyReader);
  if (!vocabulary.ok) return vocabulary;
  return ok(toExerciseDetails(exercise.value, vocabulary.value));
}

export function createGetExerciseDetails(deps: GetExerciseDetailsDependencies): GetExerciseDetails {
  return async (id) =>
    logged(deps.logger, 'The exercise could not be shown.', await details(deps, id));
}
