import { createToken } from '@shared/application/di/token';
import type { Logger } from '@shared/application/logger';
import { map, type Result } from '@shared/domain/result';

import type { VocabularyValueError } from '../domain/exercise-errors';
import {
  resolveNewVocabularyValue,
  type ResolvedVocabularyValue,
  type Vocabulary,
  type VocabularyKind,
} from '../domain/vocabulary';

import type { EnsureLibrarySeeded } from './ensure-library-seeded';
import { toVocabularyOption } from './exercise-dto-mappers';
import type { ResolvedVocabularyOption } from './exercise-dtos';
import type { VocabularyReader } from './exercise-repository';
import type { ExerciseLibraryError } from './library-errors';
import { loadVocabulary, logged } from './library-use-case-support';

/**
 * Use case: "Add your own" in a picker (S1-29). Validates and normalises the text and compares it
 * with the stored values of that kind using the domain (`resolveVocabularySelection`):
 * - equal to a built-in or stored user-defined value → that existing option (no new value);
 * - otherwise → a new option (`isCustom: true`) and `selection: { source: 'new', label }`;
 * - blank / too long → `exercises.vocabularyValueRequired` / `exercises.vocabularyValueTooLong`.
 * **Persists nothing**: the value is saved with the exercise (a discarded form leaves no value).
 * Values added earlier in the same form are not stored yet; the form de-duplicates them by the
 * returned `option.key` (key equality only, no rule). Never rejects.
 *
 * Phase 2: `createResolveVocabularyValue(deps: { ensureLibrarySeeded; vocabularyReader; logger })`.
 */
export type ResolveVocabularyValue = (
  kind: VocabularyKind,
  label: string,
) => Promise<Result<ResolvedVocabularyOption, VocabularyValueError | ExerciseLibraryError>>;

export const ResolveVocabularyValueToken = createToken<ResolveVocabularyValue>(
  'exercises.ResolveVocabularyValue',
);

export interface ResolveVocabularyValueDependencies {
  readonly ensureLibrarySeeded: EnsureLibrarySeeded;
  readonly vocabularyReader: VocabularyReader;
  readonly logger: Logger;
}

function toResolvedOption({ value, isNew }: ResolvedVocabularyValue): ResolvedVocabularyOption {
  return Object.freeze({
    option: toVocabularyOption(value),
    selection: Object.freeze(
      isNew
        ? { source: 'new' as const, label: value.label }
        : { source: 'existing' as const, key: value.key },
    ),
  });
}

/** Seeding and storage failures only; an invalid label is the user's input, not a fault. */
async function loadLibraryVocabulary(
  deps: ResolveVocabularyValueDependencies,
): Promise<Result<Vocabulary, ExerciseLibraryError>> {
  const seeded = await deps.ensureLibrarySeeded();
  if (!seeded.ok) return seeded;
  return loadVocabulary(deps.vocabularyReader);
}

export function createResolveVocabularyValue(
  deps: ResolveVocabularyValueDependencies,
): ResolveVocabularyValue {
  return async (kind, label) => {
    const vocabulary = logged(
      deps.logger,
      'The vocabulary could not be read.',
      await loadLibraryVocabulary(deps),
    );
    if (!vocabulary.ok) return vocabulary;
    return map(resolveNewVocabularyValue(vocabulary.value, kind, label), toResolvedOption);
  };
}
