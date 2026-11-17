import { renderHook } from '@testing-library/react-native';

import { ok, type Result } from '@shared/domain/result';
import { aVocabularyOption } from '@test/builders/exercise-dtos.builder';
import {
  exerciseContainer,
  vocabularyOptions,
  withContainer,
  type ExerciseUseCases,
} from '@test/support/exercise-screen-harness';

import type {
  ExerciseFormValues,
  ExerciseInput,
} from '@modules/exercises/application/exercise-dtos';
import type { SaveExerciseError } from '@modules/exercises/application/save-exercise-errors';
import { BLANK_FORM_VALUES } from '@modules/exercises/presentation/exercise-form-fields';
import {
  useExerciseEditor,
  type SaveSubmitter,
} from '@modules/exercises/presentation/use-exercise-editor';

/**
 * Test harness of the `useExerciseEditor` view-model hook (S1-19 to S1-23, S1-29): the editor
 * rendered with the shared use-case stubs, and a save use case that records what it was given.
 */

export const option = (label: string) => aVocabularyOption().labelled(label).build();
export const sandbag = aVocabularyOption().labelled('Sandbag').custom().build();

export function recordingSubmit(outcome: Result<unknown, SaveExerciseError> = ok(undefined)) {
  const inputs: ExerciseInput[] = [];
  const submit: SaveSubmitter = (input) => {
    inputs.push(input);
    return Promise.resolve(outcome);
  };
  return { submit, inputs, last: () => inputs.at(-1) };
}

export async function renderEditor(
  initial: ExerciseFormValues = BLANK_FORM_VALUES,
  submit: SaveSubmitter = recordingSubmit().submit,
  overrides: Partial<ExerciseUseCases> = {},
) {
  return renderHook(() => useExerciseEditor({ initial, options: vocabularyOptions, submit }), {
    wrapper: withContainer(exerciseContainer(overrides)),
  });
}
