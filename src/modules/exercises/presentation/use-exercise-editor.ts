import { useMemo, useState } from 'react';

import { useDependency } from '@core/presentation';
import type { Result } from '@shared/domain/result';

import type { PhotoFileName } from '../domain/exercise';
import { EXERCISE_LIMITS } from '../domain/exercise-draft';
import type { ExerciseField } from '../domain/exercise-errors';
import type { TrackedMetric } from '../domain/tracked-metric';
import type { VocabularyKind } from '../domain/vocabulary';
import { DiscardPhotosToken } from '../application/discard-photos';
import type {
  ExerciseFormValues,
  ExerciseInput,
  VocabularyOption,
  VocabularyOptions,
} from '../application/exercise-dtos';
import { ImportPhotoToken } from '../application/import-photo';
import type { PhotoSource } from '../application/photo-ports';
import { ResolveVocabularyValueToken } from '../application/resolve-vocabulary-value';
import type { SaveExerciseError } from '../application/save-exercise-errors';

import {
  addOwnValueErrorMessage,
  exerciseErrorMessage,
  photoErrorMessage,
} from './exercise-error-texts';
import {
  chosenExisting,
  fieldsFrom,
  sameInput,
  sameOption,
  toggledIn,
  toInput,
  VOCABULARY_OF,
  withoutPhoto,
  type ChosenValue,
  type FormFields,
  type MultiValueField,
  type SingleValueField,
  type VocabularyField,
} from './exercise-form-fields';
import { fieldErrors } from './exercise-issue-texts';

/** Create or update, as chosen by the screen; `T` is what a successful save returns. */
export type SaveSubmitter<T = unknown> = (
  input: ExerciseInput,
) => Promise<Result<T, SaveExerciseError>>;

export type SaveOutcome<T> =
  { readonly saved: true; readonly value: T } | { readonly saved: false };

export interface ExerciseEditorOptions<T> {
  readonly initial: ExerciseFormValues;
  readonly options: VocabularyOptions;
  readonly submit: SaveSubmitter<T>;
}

export interface ExerciseEditor<T> {
  readonly fields: FormFields;
  readonly isDirty: boolean;
  readonly isSaving: boolean;
  /** Field → text from the domain's issue codes (S1-19: every problem next to its field). */
  readonly errors: Partial<Record<ExerciseField, string>>;
  /** A save failure that is not about a field (e.g. storage). */
  readonly formError: string | undefined;
  readonly photoError: string | undefined;
  readonly canAddPhoto: boolean;
  readonly setName: (name: string) => void;
  readonly setInstructionsText: (text: string) => void;
  readonly toggleMetric: (metric: TrackedMetric) => void;
  readonly selectOne: (field: SingleValueField, option: VocabularyOption) => void;
  readonly toggleMany: (field: MultiValueField, option: VocabularyOption) => void;
  readonly optionsFor: (field: VocabularyField) => readonly VocabularyOption[];
  /** "Add your own" (S1-29); resolves the text to show in the input when rejected. */
  readonly addOwnValue: (field: VocabularyField, label: string) => Promise<string | undefined>;
  readonly addPhoto: (source: PhotoSource) => Promise<void>;
  readonly removePhoto: (fileName: PhotoFileName) => void;
  readonly save: () => Promise<SaveOutcome<T>>;
  /** Leaving without saving: deletes the photo copies imported in this form (S1-22). */
  readonly discard: () => Promise<void>;
}

const NO_EXTRA_OPTIONS: Readonly<Record<VocabularyKind, readonly VocabularyOption[]>> = {
  category: [],
  muscle: [],
  equipment: [],
};

function isMultiValueField(field: VocabularyField): field is MultiValueField {
  return field === 'primaryMuscles' || field === 'secondaryMuscles';
}

/** Adds `chosen` to a picker's value (multi: once; single: replaces). */
function withChosen(fields: FormFields, field: VocabularyField, chosen: ChosenValue): FormFields {
  if (!isMultiValueField(field)) {
    return { ...fields, [field]: chosen };
  }
  const current = fields[field];
  return current.some((existing) => sameOption(existing, chosen))
    ? fields
    : { ...fields, [field]: [...current, chosen] };
}

/**
 * View-model hook (MVVM) of the custom-exercise form while editing (S1-19, S1-20, S1-22, S1-23,
 * S1-29). Holds the raw values, previews "Add your own" values through `ResolveVocabularyValue`
 * (nothing is stored until Save), imports photos through `ImportPhoto`, and submits through the
 * create or update use case given by the screen. Shows the domain's issues by field; never checks
 * a rule itself.
 */
export function useExerciseEditor<T>({
  initial,
  options,
  submit,
}: ExerciseEditorOptions<T>): ExerciseEditor<T> {
  const resolveVocabularyValue = useDependency(ResolveVocabularyValueToken);
  const importPhoto = useDependency(ImportPhotoToken);
  const discardPhotos = useDependency(DiscardPhotosToken);
  const initialFields = useMemo(() => fieldsFrom(initial), [initial]);
  const [fields, setFields] = useState<FormFields>(initialFields);
  const [extraOptions, setExtraOptions] = useState(NO_EXTRA_OPTIONS);
  const [errors, setErrors] = useState<Partial<Record<ExerciseField, string>>>({});
  const [formError, setFormError] = useState<string>();
  const [photoError, setPhotoError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  /** Photo copies imported by this form (kept or removed since): the only files it may discard. */
  const [importedPhotos, setImportedPhotos] = useState<readonly PhotoFileName[]>([]);

  const optionsFor = (field: VocabularyField) => {
    const kind = VOCABULARY_OF[field];
    const base = options[kind];
    return [
      ...base,
      ...extraOptions[kind].filter((extra) => !base.some((o) => o.key === extra.key)),
    ];
  };

  const addOwnValue = async (field: VocabularyField, label: string) => {
    const kind = VOCABULARY_OF[field];
    const result = await resolveVocabularyValue(kind, label);
    if (!result.ok) {
      return addOwnValueErrorMessage(result.error);
    }
    const { option, selection } = result.value;
    setExtraOptions((current) =>
      current[kind].some((extra) => extra.key === option.key)
        ? current
        : { ...current, [kind]: [...current[kind], option] },
    );
    setFields((current) => withChosen(current, field, { option, selection }));
    return undefined;
  };

  const addPhoto = async (source: PhotoSource) => {
    setPhotoError(undefined);
    const result = await importPhoto(source);
    if (!result.ok) {
      setPhotoError(photoErrorMessage(result.error));
      return;
    }
    const photo = result.value;
    if (photo !== null) {
      setImportedPhotos((current) => [...current, photo.fileName]);
      setFields((current) => ({ ...current, photos: [...current.photos, photo] }));
    }
  };

  const save = async (): Promise<SaveOutcome<T>> => {
    setIsSaving(true);
    const result = await submit(toInput(fields));
    setIsSaving(false);
    if (result.ok) {
      setErrors({});
      setFormError(undefined);
      const kept = new Set(fields.photos.map((photo) => photo.fileName));
      const leftovers = importedPhotos.filter((fileName) => !kept.has(fileName));
      if (leftovers.length > 0) {
        await discardPhotos(leftovers);
      }
      return { saved: true, value: result.value };
    }
    const { error } = result;
    if (error.code === 'exercises.invalidExercise') {
      setErrors(fieldErrors(error.issues));
      setFormError(undefined);
    } else {
      setErrors({});
      setFormError(exerciseErrorMessage(error));
    }
    return { saved: false };
  };

  const discard = async () => {
    if (importedPhotos.length > 0) {
      await discardPhotos(importedPhotos);
    }
  };

  return {
    fields,
    // An imported copy counts even if removed again: leaving must offer to discard it.
    isDirty: !sameInput(fields, initialFields) || importedPhotos.length > 0,
    isSaving,
    errors,
    formError,
    photoError,
    canAddPhoto: fields.photos.length < EXERCISE_LIMITS.photosMax,
    setName: (name) => setFields((current) => ({ ...current, name })),
    setInstructionsText: (instructionsText) =>
      setFields((current) => ({ ...current, instructionsText })),
    toggleMetric: (metric) =>
      setFields((current) => ({
        ...current,
        trackedMetrics: toggledIn(current.trackedMetrics, metric, (a, b) => a === b),
      })),
    selectOne: (field, option) =>
      setFields((current) => ({
        ...current,
        [field]: current[field]?.option.key === option.key ? null : chosenExisting(option),
      })),
    toggleMany: (field, option) =>
      setFields((current) => ({
        ...current,
        [field]: toggledIn(current[field], chosenExisting(option), sameOption),
      })),
    optionsFor,
    addOwnValue,
    addPhoto,
    removePhoto: (fileName) =>
      setFields((current) => ({ ...current, photos: withoutPhoto(current.photos, fileName) })),
    save,
    discard,
  };
}
