import { createToken } from '@shared/application/di/token';
import type { Logger } from '@shared/application/logger';
import { map, type Result } from '@shared/domain/result';

import type { EnsureLibrarySeeded } from './ensure-library-seeded';
import { toVocabularyOptions } from './exercise-dto-mappers';
import type { VocabularyOptions } from './exercise-dtos';
import type { VocabularyReader } from './exercise-repository';
import type { ExerciseLibraryError } from './library-errors';
import { loadVocabulary, logged } from './library-use-case-support';

/**
 * Use case: the values of each vocabulary for the library filters and the form pickers (S1-15,
 * S1-29): built-in and user-defined together, merged by the domain (`mergeVocabulary`: one entry
 * per key, built-in wins), alphabetical. Awaits `EnsureLibrarySeeded`. Never rejects.
 *
 * Phase 2: `createListVocabularyOptions(deps: { ensureLibrarySeeded; vocabularyReader; logger })`.
 */
export type ListVocabularyOptions = () => Promise<Result<VocabularyOptions, ExerciseLibraryError>>;

export const ListVocabularyOptionsToken = createToken<ListVocabularyOptions>(
  'exercises.ListVocabularyOptions',
);

export interface ListVocabularyOptionsDependencies {
  readonly ensureLibrarySeeded: EnsureLibrarySeeded;
  readonly vocabularyReader: VocabularyReader;
  readonly logger: Logger;
}

async function listOptions(
  deps: ListVocabularyOptionsDependencies,
): Promise<Result<VocabularyOptions, ExerciseLibraryError>> {
  const seeded = await deps.ensureLibrarySeeded();
  if (!seeded.ok) return seeded;
  return map(await loadVocabulary(deps.vocabularyReader), toVocabularyOptions);
}

export function createListVocabularyOptions(
  deps: ListVocabularyOptionsDependencies,
): ListVocabularyOptions {
  return async () =>
    logged(deps.logger, 'The vocabulary options could not be read.', await listOptions(deps));
}
