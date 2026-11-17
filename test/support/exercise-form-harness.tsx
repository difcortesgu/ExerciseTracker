import { router } from 'expo-router';
import { act, fireEvent, screen } from 'expo-router/testing-library';

import type { ExerciseId } from '@shared/domain/ids';
import { ok, type Result } from '@shared/domain/result';
import { exerciseIdOf } from '@test/builders/exercise.builder';
import {
  exerciseContainer,
  renderExerciseApp,
  type ExerciseUseCases,
} from '@test/support/exercise-screen-harness';

import type { ExerciseInput } from '@modules/exercises/application/exercise-dtos';
import type { SaveExerciseError } from '@modules/exercises/application/save-exercise-errors';

/**
 * Test harness of the custom-exercise form screens (S1-19 to S1-23, S1-29): opens a form on top
 * of the library as the user does, fills it through its labels, and records what Save sent.
 */

export type CreateResult = Result<ExerciseId, SaveExerciseError>;

export function recordingCreate(outcome: CreateResult = ok(exerciseIdOf('new-1'))) {
  const inputs: ExerciseInput[] = [];
  const createCustomExercise = (input: ExerciseInput) => {
    inputs.push(input);
    return Promise.resolve(outcome);
  };
  return { createCustomExercise, inputs };
}

/** Opens the form from the library (so leaving has somewhere to go back to). */
export async function openForm(path: string, overrides: Partial<ExerciseUseCases> = {}) {
  const view = await renderExerciseApp(exerciseContainer(overrides));
  await screen.findByLabelText('Search exercises');
  await act(() => router.push(path));
  return view;
}

export const press = async (name: string | RegExp) =>
  fireEvent.press(await screen.findByRole('button', { name }));

export async function pick(field: string, value: string) {
  await press(field);
  await fireEvent.press(await screen.findByRole('checkbox', { name: value }));
  await press('Done');
}

export async function fillValidForm() {
  await fireEvent.changeText(await screen.findByLabelText('Name'), 'My Goblet Squat');
  await pick('Category', 'Strength');
  await pick('Primary muscles', 'Quadriceps');
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Weight' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Reps' }));
}
