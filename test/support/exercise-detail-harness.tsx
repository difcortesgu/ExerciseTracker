import { router } from 'expo-router';
import { act } from 'expo-router/testing-library';

import { domainError } from '@shared/domain/domain-error';
import { err, ok } from '@shared/domain/result';
import { anExerciseDetails } from '@test/builders/exercise-dtos.builder';
import {
  exerciseContainer,
  renderExerciseApp,
  type ExerciseUseCases,
} from '@test/support/exercise-screen-harness';

import type { ExerciseDetails } from '@modules/exercises/application/exercise-dtos';

/**
 * Test harness of the exercise detail screen (S1-17, S1-21, S1-23): a built-in and a custom
 * exercise, and a detail opened from the library as the user does.
 */

export const builtIn = anExerciseDetails().withId('barbell-squat').build();
export const custom = anExerciseDetails()
  .withId('my-goblet-squat')
  .named('My Goblet Squat')
  .custom()
  .withPhotos('photo-1.jpg')
  .build();
export const notFound = domainError('exercises.notFound', 'No exercise "gone".');

export async function openDetail(
  details: ExerciseDetails | null,
  overrides: Partial<ExerciseUseCases> = {},
  id = details?.id ?? 'gone',
) {
  const container = exerciseContainer({
    getExerciseDetails: () => Promise.resolve(details === null ? err(notFound) : ok(details)),
    ...overrides,
  });
  // Open from the library, as the user does, so "back" has somewhere to go.
  const view = await renderExerciseApp(container);
  await act(() => router.push(`/exercises/${id}`));
  return view;
}
