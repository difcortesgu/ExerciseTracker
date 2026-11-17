import type { PhotoFileName } from '../domain/exercise';
import type { TrackedMetric } from '../domain/tracked-metric';
import type { VocabularyKind, VocabularySelection } from '../domain/vocabulary';
import type {
  ExerciseFormValues,
  ExerciseInput,
  PhotoView,
  VocabularyOption,
} from '../application/exercise-dtos';

/**
 * Editing state of the custom-exercise form (S1-19, S1-20, S1-23, S1-29) and its mapping to the
 * `ExerciseInput` the save use cases take. Pure data plumbing: no validation (the domain does it).
 */

/** A value chosen in a picker: what the form shows and what it sends on Save. */
export interface ChosenValue {
  readonly option: VocabularyOption;
  readonly selection: VocabularySelection;
}

export interface FormFields {
  readonly name: string;
  readonly category: ChosenValue | null;
  readonly primaryMuscles: readonly ChosenValue[];
  readonly secondaryMuscles: readonly ChosenValue[];
  readonly equipment: ChosenValue | null;
  readonly instructionsText: string;
  readonly photos: readonly PhotoView[];
  readonly trackedMetrics: readonly TrackedMetric[];
}

/** Pickers that hold one value (tapping the chosen one clears it). */
export type SingleValueField = 'category' | 'equipment';
/** Pickers that hold several values. */
export type MultiValueField = 'primaryMuscles' | 'secondaryMuscles';
export type VocabularyField = SingleValueField | MultiValueField;

/** Which vocabulary each picker shows (both muscle pickers share the muscle vocabulary). */
export const VOCABULARY_OF: Readonly<Record<VocabularyField, VocabularyKind>> = {
  category: 'category',
  equipment: 'equipment',
  primaryMuscles: 'muscle',
  secondaryMuscles: 'muscle',
};

/** The create form (S1-19): everything empty, no metric preselected (A7). */
export const BLANK_FORM_VALUES: ExerciseFormValues = Object.freeze({
  name: '',
  category: null,
  primaryMuscles: [],
  secondaryMuscles: [],
  equipment: null,
  instructionsText: '',
  photos: [],
  trackedMetrics: [],
});

/** An existing option is sent by its key (`ExerciseInput` contract). */
export const chosenExisting = (option: VocabularyOption): ChosenValue => ({
  option,
  selection: { source: 'existing', key: option.key },
});

const chosenOrNull = (option: VocabularyOption | null) =>
  option === null ? null : chosenExisting(option);

export function fieldsFrom(values: ExerciseFormValues): FormFields {
  return {
    name: values.name,
    category: chosenOrNull(values.category),
    primaryMuscles: values.primaryMuscles.map(chosenExisting),
    secondaryMuscles: values.secondaryMuscles.map(chosenExisting),
    equipment: chosenOrNull(values.equipment),
    instructionsText: values.instructionsText,
    photos: values.photos,
    trackedMetrics: values.trackedMetrics,
  };
}

/** What Save submits: the raw values, exactly as entered (the domain normalises and validates). */
export function toInput(fields: FormFields): ExerciseInput {
  return {
    name: fields.name,
    category: fields.category?.selection ?? null,
    primaryMuscles: fields.primaryMuscles.map((chosen) => chosen.selection),
    secondaryMuscles: fields.secondaryMuscles.map((chosen) => chosen.selection),
    equipment: fields.equipment?.selection ?? null,
    instructionsText: fields.instructionsText,
    photos: fields.photos.map((photo) => photo.fileName),
    trackedMetrics: fields.trackedMetrics,
  };
}

/** Whether two states would submit the same input ("Discard changes?" only when they differ). */
export function sameInput(first: FormFields, second: FormFields): boolean {
  return JSON.stringify(toInput(first)) === JSON.stringify(toInput(second));
}

export function toggledIn<T>(values: readonly T[], value: T, same: (a: T, b: T) => boolean): T[] {
  return values.some((existing) => same(existing, value))
    ? values.filter((existing) => !same(existing, value))
    : [...values, value];
}

export const sameOption = (first: ChosenValue, second: ChosenValue): boolean =>
  first.option.key === second.option.key;

export function withoutPhoto(
  photos: readonly PhotoView[],
  fileName: PhotoFileName,
): readonly PhotoView[] {
  return photos.filter((photo) => photo.fileName !== fileName);
}
