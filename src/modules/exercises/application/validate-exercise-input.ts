import { err, type Result } from '@shared/domain/result';

import { comparisonKey } from '../domain/comparison-key';
import {
  duplicateNameIssue,
  invalidExercise,
  validateExerciseDraft,
  type ValidatedExerciseDraft,
} from '../domain/exercise-draft';
import type { ExerciseValidationError } from '../domain/exercise-errors';
import type { ExerciseId } from '@shared/domain/ids';

import type { ExerciseInput } from './exercise-dtos';
import type { ExerciseReader, ExerciseStorageError, VocabularyReader } from './exercise-repository';
import { loadVocabulary } from './library-use-case-support';

export interface ValidateExerciseInputDependencies {
  readonly reader: ExerciseReader;
  readonly vocabularyReader: VocabularyReader;
}

/**
 * The validation step shared by create and update (S1-19, S1-20): the domain's field rules
 * (`validateExerciseDraft`) **and** name uniqueness against every active exercise (decision Q6),
 * ignoring `excluding` (an exercise never collides with itself). A name conflict is one more
 * `exercises.duplicateName` issue in the same `exercises.invalidExercise`, after the field issues.
 */
export async function validateExerciseInput(
  deps: ValidateExerciseInputDependencies,
  input: ExerciseInput,
  excluding?: ExerciseId,
): Promise<Result<ValidatedExerciseDraft, ExerciseValidationError | ExerciseStorageError>> {
  const vocabulary = await loadVocabulary(deps.vocabularyReader);
  if (!vocabulary.ok) return vocabulary;
  const conflict = await deps.reader.findActiveByNameKey(comparisonKey(input.name), excluding);
  if (!conflict.ok) return conflict;
  const validated = validateExerciseDraft(input, vocabulary.value);
  if (conflict.value === null) return validated;
  const fieldIssues = validated.ok ? [] : validated.error.issues;
  return err(invalidExercise([...fieldIssues, duplicateNameIssue(conflict.value.name)]));
}
