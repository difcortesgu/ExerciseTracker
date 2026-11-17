import { err, ok, type Result } from '@shared/domain/result';

import { characterCount, normaliseDisplayText } from './comparison-key';
import type { ExerciseField, ExerciseFieldErrorCode, ExerciseFieldIssue } from './exercise-errors';
import {
  resolveVocabularySelection,
  type ResolvedVocabularyValue,
  type Vocabulary,
  type VocabularyKind,
  type VocabularySelection,
} from './vocabulary';

/**
 * Field rules of the custom-exercise draft (S1-08), used by `validateExerciseDraft`. Each rule
 * returns the field's value or its issues, so the draft can report **every** problem at once.
 */
export type FieldResult<T> = Result<T, readonly ExerciseFieldIssue[]>;

type Details = Readonly<Record<string, unknown>>;

export function fieldIssue(
  field: ExerciseField,
  code: ExerciseFieldErrorCode,
  message: string,
  details?: Details,
): ExerciseFieldIssue {
  return details === undefined
    ? Object.freeze({ field, code, message })
    : Object.freeze({ field, code, message, details: Object.freeze({ ...details }) });
}

/** A field that failed with one issue. */
export function failedField(
  field: ExerciseField,
  code: ExerciseFieldErrorCode,
  message: string,
  details?: Details,
): FieldResult<never> {
  return err(Object.freeze([fieldIssue(field, code, message, details)]));
}

export function issuesOf(result: FieldResult<unknown>): readonly ExerciseFieldIssue[] {
  return result.ok ? [] : result.error;
}

/** Trimmed, whitespace collapsed, 1..`maximum` characters. */
export function validateName(raw: string, maximum: number): FieldResult<string> {
  const name = normaliseDisplayText(raw);
  if (name.length === 0) return failedField('name', 'exercises.nameRequired', 'Enter a name.');
  if (characterCount(name) > maximum) {
    return failedField('name', 'exercises.nameTooLong', `Use at most ${maximum} characters.`, {
      maximum,
    });
  }
  return ok(name);
}

/** One selection resolved against its vocabulary; a list position is added to the details. */
export function resolveField(
  vocabulary: Vocabulary,
  kind: VocabularyKind,
  field: ExerciseField,
  selection: VocabularySelection,
  index?: number,
): FieldResult<ResolvedVocabularyValue> {
  const resolved = resolveVocabularySelection(vocabulary, kind, selection);
  if (resolved.ok) return resolved;
  const { code, message, details } = resolved.error;
  return failedField(field, code, message, index === undefined ? details : { ...details, index });
}

/** Every selection of a list field, de-duplicated by key in first-selection order. */
export function resolveListField(
  vocabulary: Vocabulary,
  kind: VocabularyKind,
  field: ExerciseField,
  selections: readonly VocabularySelection[],
): FieldResult<readonly ResolvedVocabularyValue[]> {
  const values: ResolvedVocabularyValue[] = [];
  const issues: ExerciseFieldIssue[] = [];
  selections.forEach((selection, index) => {
    const result = resolveField(vocabulary, kind, field, selection, index);
    if (result.ok) values.push(result.value);
    else issues.push(...result.error);
  });
  if (issues.length > 0) return err(Object.freeze(issues));
  return ok(
    Object.freeze(
      values.filter(
        (resolved, index) =>
          values.findIndex((other) => other.value.key === resolved.value.key) === index,
      ),
    ),
  );
}

/** A muscle may be primary or secondary, never both (S1-08). */
export function checkNoMuscleListedTwice(
  primary: readonly ResolvedVocabularyValue[],
  secondary: readonly ResolvedVocabularyValue[],
): FieldResult<void> {
  const primaryKeys = new Set(primary.map(({ value }) => value.key));
  const issues = secondary
    .filter(({ value }) => primaryKeys.has(value.key))
    .map(({ value }) =>
      fieldIssue(
        'secondaryMuscles',
        'exercises.muscleListedTwice',
        `"${value.label}" is already a primary muscle.`,
        { key: value.key },
      ),
    );
  return issues.length > 0 ? err(Object.freeze(issues)) : ok(undefined);
}
