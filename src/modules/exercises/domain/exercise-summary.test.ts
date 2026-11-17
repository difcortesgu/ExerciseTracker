import { aBuiltInExercise, aCustomExercise } from '@test/builders/exercise.builder';

import { summariseExercise } from './exercise-summary';

describe('summariseExercise', () => {
  it('keeps the list fields of a built-in and its first image as cover', () => {
    const exercise = aBuiltInExercise().build();

    expect(summariseExercise(exercise)).toEqual({
      id: exercise.id,
      name: 'Barbell Squat',
      origin: 'builtIn',
      category: 'strength',
      primaryMuscles: ['quadriceps'],
      equipment: 'barbell',
      coverImage: exercise.images[0],
    });
  });

  it('uses the first photo of a custom exercise as cover, or none', () => {
    expect(
      summariseExercise(aCustomExercise().withPhotos('b.jpg', 'a.jpg').build()).coverImage,
    ).toEqual({
      kind: 'photo',
      fileName: 'b.jpg',
    });
    expect(summariseExercise(aCustomExercise().build()).coverImage).toBeNull();
  });

  it('returns a frozen summary', () => {
    expect(Object.isFrozen(summariseExercise(aCustomExercise().build()))).toBe(true);
  });
});
