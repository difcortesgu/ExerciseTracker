import { err, ok, type Result } from '@shared/domain/result';

import { characterCount, normaliseDisplayText } from './comparison-key';
import type { CustomPhoto, PhotoFileName } from './exercise';
import type { ExerciseFieldIssue, ExerciseValidationError } from './exercise-errors';
import {
  checkNoMuscleListedTwice,
  failedField,
  fieldIssue,
  issuesOf,
  resolveField,
  resolveListField,
  validateName,
  type FieldResult,
} from './exercise-field-rules';
import { normaliseTrackedMetrics, type TrackedMetric } from './tracked-metric';
import type {
  ResolvedVocabularyValue,
  Vocabulary,
  VocabularyKey,
  VocabularySelection,
  VocabularyValue,
} from './vocabulary';

/**
 * What the custom-exercise form submits (S1-19, S1-20, S1-23), before validation. The form never
 * re-implements a rule: it sends raw values and shows the issues the domain returns.
 *
 * Next to these types (S1-08/S1-29):
 * - `EXERCISE_LIMITS = { nameMaxLength: 80, instructionsMaxLength: 5_000, photosMax: 6 }` (named
 *   constants; presentation may read `photosMax` for the "Up to 6 photos" hint);
 * - `parseInstructions(text: string): readonly string[]` — one step per line, each line
 *   display-normalised, blank lines dropped (A6); `formatInstructions(steps): string` joins with
 *   `\n` (edit prefill);
 * - `validateExerciseDraft(draft, vocabulary: Vocabulary):
 *   Result<ValidatedExerciseDraft, ExerciseValidationError>` — collects **every** field issue
 *   (codes in `exercise-errors.ts`); never checks name uniqueness (needs the repository: the
 *   create/update use cases add `exercises.duplicateName` to the same issue list).
 */
export interface ExerciseDraft {
  readonly name: string;
  /** `null` until the user picks one (→ `exercises.categoryRequired`). */
  readonly category: VocabularySelection | null;
  readonly primaryMuscles: readonly VocabularySelection[];
  readonly secondaryMuscles: readonly VocabularySelection[];
  /** `null` = not specified. */
  readonly equipment: VocabularySelection | null;
  /** Multi-line text, one step per line (A6). */
  readonly instructionsText: string;
  /** App-owned photos in display order (already imported through `ImportPhoto`, S1-22). */
  readonly photos: readonly PhotoFileName[];
  /** Any order, duplicates allowed; stored de-duplicated in canonical order. */
  readonly trackedMetrics: readonly TrackedMetric[];
}

/** A draft that passed validation, with every selection resolved to a key. */
export interface ValidatedExerciseDraft {
  readonly name: string;
  readonly category: VocabularyKey;
  readonly primaryMuscles: readonly VocabularyKey[];
  readonly secondaryMuscles: readonly VocabularyKey[];
  readonly equipment: VocabularyKey | null;
  readonly instructions: readonly string[];
  readonly images: readonly CustomPhoto[];
  readonly trackedMetrics: readonly TrackedMetric[];
  /** New `custom` vocabulary values to persist together with the exercise (S1-29), de-duplicated. */
  readonly newVocabularyValues: readonly VocabularyValue[];
}

/** Limits of a custom exercise (S1-08, A5, A6); presentation reads `photosMax` for its hint. */
export const EXERCISE_LIMITS = Object.freeze({
  nameMaxLength: 80,
  instructionsMaxLength: 5_000,
  photosMax: 6,
});

const LINE_BREAK = '\n';

/** One step per line, each display-normalised, blank lines dropped (A6). */
export function parseInstructions(text: string): readonly string[] {
  return Object.freeze(
    text
      .split(LINE_BREAK)
      .map(normaliseDisplayText)
      .filter((step) => step.length > 0),
  );
}

/** Steps joined one per line (edit prefill, S1-20). */
export function formatInstructions(steps: readonly string[]): string {
  return steps.join(LINE_BREAK);
}

/** The error carrying every field issue (the use cases add `exercises.duplicateName` to it). */
export function invalidExercise(issues: readonly ExerciseFieldIssue[]): ExerciseValidationError {
  return Object.freeze({
    code: 'exercises.invalidExercise',
    message: 'The exercise has invalid fields.',
    issues: Object.freeze([...issues]),
  });
}

/** The name is taken by an active exercise (decision Q6; checked by the use cases). */
export function duplicateNameIssue(existingName: string): ExerciseFieldIssue {
  return fieldIssue('name', 'exercises.duplicateName', `'${existingName}' already exists.`, {
    existingName,
  });
}

function validateInstructions(text: string): FieldResult<readonly string[]> {
  const steps = parseInstructions(text);
  const maximum = EXERCISE_LIMITS.instructionsMaxLength;
  return characterCount(formatInstructions(steps)) > maximum
    ? failedField(
        'instructions',
        'exercises.instructionsTooLong',
        `Use at most ${maximum} characters.`,
        {
          maximum,
        },
      )
    : ok(steps);
}

function validatePhotos(photos: readonly PhotoFileName[]): FieldResult<readonly CustomPhoto[]> {
  const unique = [...new Set(photos)];
  const maximum = EXERCISE_LIMITS.photosMax;
  return unique.length > maximum
    ? failedField('photos', 'exercises.tooManyPhotos', `Add at most ${maximum} photos.`, {
        maximum,
      })
    : ok(
        Object.freeze(
          unique.map((fileName) => Object.freeze({ kind: 'photo' as const, fileName })),
        ),
      );
}

function validateMetrics(metrics: readonly TrackedMetric[]): FieldResult<readonly TrackedMetric[]> {
  const normalised = normaliseTrackedMetrics(metrics);
  return normalised.length === 0
    ? failedField('trackedMetrics', 'exercises.noTrackedMetric', 'Pick at least one metric.')
    : ok(normalised);
}

function validatePrimaryMuscles(
  vocabulary: Vocabulary,
  selections: readonly VocabularySelection[],
): FieldResult<readonly ResolvedVocabularyValue[]> {
  return selections.length === 0
    ? failedField('primaryMuscles', 'exercises.primaryMuscleRequired', 'Pick a primary muscle.')
    : resolveListField(vocabulary, 'muscle', 'primaryMuscles', selections);
}

const keysOf = (values: readonly ResolvedVocabularyValue[]): readonly VocabularyKey[] =>
  Object.freeze(values.map(({ value }) => value.key));

/**
 * New user-defined values to persist with the exercise. Lists are already de-duplicated by key,
 * kinds never collide, and the same new muscle in both lists is rejected as listed twice.
 */
const newValuesOf = (resolved: readonly ResolvedVocabularyValue[]): readonly VocabularyValue[] =>
  Object.freeze(resolved.filter(({ isNew }) => isNew).map(({ value }) => value));

/**
 * Validates a draft against the merged vocabulary (S1-08, S1-29) and returns **every** field issue
 * at once. Name uniqueness needs the repository and is checked by the use cases.
 */
export function validateExerciseDraft(
  draft: ExerciseDraft,
  vocabulary: Vocabulary,
): Result<ValidatedExerciseDraft, ExerciseValidationError> {
  const name = validateName(draft.name, EXERCISE_LIMITS.nameMaxLength);
  const category =
    draft.category === null
      ? failedField('category', 'exercises.categoryRequired', 'Pick a category.')
      : resolveField(vocabulary, 'category', 'category', draft.category);
  const primary = validatePrimaryMuscles(vocabulary, draft.primaryMuscles);
  const secondary = resolveListField(
    vocabulary,
    'muscle',
    'secondaryMuscles',
    draft.secondaryMuscles,
  );
  const notTwice =
    primary.ok && secondary.ok
      ? checkNoMuscleListedTwice(primary.value, secondary.value)
      : ok(undefined);
  const equipment =
    draft.equipment === null
      ? ok(null)
      : resolveField(vocabulary, 'equipment', 'equipment', draft.equipment);
  const instructions = validateInstructions(draft.instructionsText);
  const images = validatePhotos(draft.photos);
  const metrics = validateMetrics(draft.trackedMetrics);
  if (
    name.ok &&
    category.ok &&
    primary.ok &&
    secondary.ok &&
    notTwice.ok &&
    equipment.ok &&
    instructions.ok &&
    images.ok &&
    metrics.ok
  ) {
    const resolved = [
      category.value,
      ...primary.value,
      ...secondary.value,
      ...(equipment.value === null ? [] : [equipment.value]),
    ];
    return ok(
      Object.freeze({
        name: name.value,
        category: category.value.value.key,
        primaryMuscles: keysOf(primary.value),
        secondaryMuscles: keysOf(secondary.value),
        equipment: equipment.value?.value.key ?? null,
        instructions: instructions.value,
        images: images.value,
        trackedMetrics: metrics.value,
        newVocabularyValues: newValuesOf(resolved),
      }),
    );
  }
  const all = [
    name,
    category,
    primary,
    secondary,
    notTwice,
    equipment,
    instructions,
    images,
    metrics,
  ];
  return err(invalidExercise(all.flatMap(issuesOf)));
}
