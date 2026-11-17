import { useCallback } from 'react';

import { useDependency } from '@core/presentation';
import type { ExerciseId } from '@shared/domain/ids';
import { err, ok, type Result } from '@shared/domain/result';

import type { BuiltInReadOnlyError } from '../domain/exercise-errors';
import { CreateCustomExerciseToken } from '../application/create-custom-exercise';
import type {
  ExerciseFormValues,
  ExerciseInput,
  VocabularyOptions,
} from '../application/exercise-dtos';
import { GetExerciseFormValuesToken } from '../application/get-exercise-form-values';
import type { ExerciseLookupError } from '../application/library-errors';
import { ListVocabularyOptionsToken } from '../application/list-vocabulary-options';
import { PrepareDuplicateToken } from '../application/prepare-duplicate';
import type { SaveExerciseError } from '../application/save-exercise-errors';
import { UpdateCustomExerciseToken } from '../application/update-custom-exercise';

import { BLANK_FORM_VALUES } from './exercise-form-fields';
import { exerciseIdFromParam, type RouteParam } from './use-exercise-details';
import { useResultLoader, type LoadState } from './use-result-loader';

/** Which form: a blank create form, a create form prefilled from a built-in, or editing. */
export type FormMode =
  | { readonly kind: 'create' }
  | { readonly kind: 'duplicate'; readonly sourceId: RouteParam }
  | { readonly kind: 'edit'; readonly id: RouteParam };

/** What Save does: create returns the new id (its detail opens), edit returns nothing. */
export type FormSubmit =
  | {
      readonly kind: 'create';
      readonly run: (input: ExerciseInput) => Promise<Result<ExerciseId, SaveExerciseError>>;
    }
  | {
      readonly kind: 'edit';
      readonly run: (input: ExerciseInput) => Promise<Result<void, SaveExerciseError>>;
    };

export interface FormData {
  readonly values: ExerciseFormValues;
  readonly options: VocabularyOptions;
  readonly submit: FormSubmit;
}

export type FormLoadError = ExerciseLookupError | BuiltInReadOnlyError;

export interface ExerciseFormViewModel {
  readonly data: LoadState<FormData, FormLoadError>;
  readonly reload: () => void;
}

type ValuesResult = Result<{ values: ExerciseFormValues; submit: FormSubmit }, FormLoadError>;

/**
 * View-model hook (MVVM) that opens the custom-exercise form (S1-19, S1-20, S1-23): the initial
 * values (blank, `GetExerciseFormValues` or `PrepareDuplicate`) together with the picker values
 * (`ListVocabularyOptions`) and the save use case of the mode. A malformed id is "not found".
 */
export function useExerciseForm(mode: FormMode): ExerciseFormViewModel {
  const getExerciseFormValues = useDependency(GetExerciseFormValuesToken);
  const prepareDuplicate = useDependency(PrepareDuplicateToken);
  const listVocabularyOptions = useDependency(ListVocabularyOptionsToken);
  const createCustomExercise = useDependency(CreateCustomExerciseToken);
  const updateCustomExercise = useDependency(UpdateCustomExerciseToken);
  const { kind } = mode;
  const param = mode.kind === 'edit' ? mode.id : mode.kind === 'duplicate' ? mode.sourceId : '';
  const rawId = typeof param === 'string' ? param : undefined;

  const load = useCallback(async (): Promise<Result<FormData, FormLoadError>> => {
    const create: FormSubmit = { kind: 'create', run: createCustomExercise };
    const loadValues = async (): Promise<ValuesResult> => {
      if (kind === 'create') {
        return ok({ values: BLANK_FORM_VALUES, submit: create });
      }
      const id = exerciseIdFromParam(rawId);
      if (!id.ok) {
        return id;
      }
      const values = await (kind === 'edit'
        ? getExerciseFormValues(id.value)
        : prepareDuplicate(id.value));
      const submit: FormSubmit =
        kind === 'edit'
          ? { kind: 'edit', run: (input) => updateCustomExercise(id.value, input) }
          : create;
      return values.ok ? ok({ values: values.value, submit }) : values;
    };
    const [values, options] = await Promise.all([loadValues(), listVocabularyOptions()]);
    if (!values.ok) {
      return values;
    }
    return options.ok ? ok({ ...values.value, options: options.value }) : err(options.error);
  }, [
    kind,
    rawId,
    createCustomExercise,
    updateCustomExercise,
    getExerciseFormValues,
    prepareDuplicate,
    listVocabularyOptions,
  ]);

  const { state, reload } = useResultLoader(load);
  return { data: state, reload };
}
