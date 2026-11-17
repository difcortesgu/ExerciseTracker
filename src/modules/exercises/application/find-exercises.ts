import { createToken } from '@shared/application/di/token';
import type { Logger } from '@shared/application/logger';
import { ok, type Result } from '@shared/domain/result';

import { findMatchingExercises } from '../domain/exercise-query';

import { toExerciseListItem } from './exercise-dto-mappers';
import type { ExerciseListItem, ExerciseSearchQuery } from './exercise-dtos';
import type { ExerciseReader, VocabularyReader } from './exercise-repository';
import type { EnsureLibrarySeeded } from './ensure-library-seeded';
import type { ExerciseLibraryError } from './library-errors';
import { loadVocabulary, logged } from './library-use-case-support';

/**
 * Use case: the library list for a search text and filters (S1-15, S1-16). Awaits
 * `EnsureLibrarySeeded` first (a seeding failure is returned as is), reads the active summaries,
 * matches and sorts them with the domain's `findMatchingExercises` (never re-implemented here or in
 * the UI) and maps them to list items with labels. Never rejects; failures are logged.
 *
 * Phase 2: `createFindExercises(deps: { ensureLibrarySeeded: EnsureLibrarySeeded;
 * reader: ExerciseReader; vocabularyReader: VocabularyReader; logger: Logger }): FindExercises`.
 * If the device check shows a keystroke-to-results time above 300 ms, add a caching **Decorator**
 * around `ExerciseReader` (invalidated by writes) instead of changing this use case.
 */
export type FindExercises = (
  query: ExerciseSearchQuery,
) => Promise<Result<readonly ExerciseListItem[], ExerciseLibraryError>>;

export const FindExercisesToken = createToken<FindExercises>('exercises.FindExercises');

export interface FindExercisesDependencies {
  readonly ensureLibrarySeeded: EnsureLibrarySeeded;
  readonly reader: ExerciseReader;
  readonly vocabularyReader: VocabularyReader;
  readonly logger: Logger;
}

async function find(
  deps: FindExercisesDependencies,
  query: ExerciseSearchQuery,
): Promise<Result<readonly ExerciseListItem[], ExerciseLibraryError>> {
  const seeded = await deps.ensureLibrarySeeded();
  if (!seeded.ok) return seeded;
  const summaries = await deps.reader.listActiveSummaries();
  if (!summaries.ok) return summaries;
  const vocabulary = await loadVocabulary(deps.vocabularyReader);
  if (!vocabulary.ok) return vocabulary;
  const matches = findMatchingExercises(summaries.value, query);
  return ok(Object.freeze(matches.map((summary) => toExerciseListItem(summary, vocabulary.value))));
}

export function createFindExercises(deps: FindExercisesDependencies): FindExercises {
  return async (query) =>
    logged(deps.logger, 'The exercise library could not be searched.', await find(deps, query));
}
