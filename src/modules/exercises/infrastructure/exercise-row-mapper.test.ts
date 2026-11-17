import { summariseExercise } from '@modules/exercises/domain/exercise-summary';
import {
  aBuiltInExercise,
  aCustomExercise,
  vocabularyKeyOf,
} from '@test/builders/exercise.builder';

import {
  builtInExerciseFromRow,
  builtInImagesFromColumn,
  exerciseFromRow,
  exerciseToRow,
  photoFileNamesFromColumn,
  summaryFromRow,
} from './exercise-row-mapper';
import type { ExerciseRow } from './exercises.schema';

const failedWith = (pattern: RegExp) => ({
  ok: false,
  error: expect.stringMatching(pattern) as unknown,
});

const corrupt = (overrides: Partial<ExerciseRow>): ExerciseRow => ({
  ...exerciseToRow(aBuiltInExercise().withId('b-1').build()),
  ...overrides,
});

describe('exercise row mapper (Data Mapper, ADR-004 §2)', () => {
  describe('exerciseToRow', () => {
    it('writes a built-in with its comparison key and JSON list columns', () => {
      const squat = aBuiltInExercise().withId('b-1').named('Barbell  Squat').build();

      expect(exerciseToRow(squat)).toEqual({
        id: 'b-1',
        origin: 'builtIn',
        sourceKey: squat.sourceKey,
        name: 'Barbell  Squat',
        nameKey: 'barbell squat',
        category: 'strength',
        equipment: 'barbell',
        level: 'beginner',
        force: 'push',
        mechanic: 'compound',
        primaryMuscles: '["quadriceps"]',
        secondaryMuscles: '["glutes","hamstrings"]',
        instructions: JSON.stringify(squat.instructions),
        images: JSON.stringify(squat.images.map(({ path, sizeBytes }) => ({ path, sizeBytes }))),
        trackedMetrics: '["weight","reps"]',
        archived: false,
      });
    });

    it('writes a custom exercise without built-in attributes, photos as file names', () => {
      const custom = aCustomExercise().withId('c-1').named('Préss').withPhotos('a.jpg').build();

      expect(exerciseToRow(custom)).toMatchObject({
        origin: 'custom',
        sourceKey: null,
        nameKey: 'press',
        level: null,
        force: null,
        mechanic: null,
        images: '["a.jpg"]',
      });
    });
  });

  describe('exerciseFromRow', () => {
    it('round-trips a built-in with optional attributes missing', () => {
      const plank = aBuiltInExercise()
        .withId('b-1')
        .with({ equipment: null, force: null, mechanic: null, images: [], archived: true })
        .build();

      expect(exerciseFromRow(exerciseToRow(plank))).toEqual({ ok: true, value: plank });
    });

    it('round-trips a custom exercise, keeping list order', () => {
      const custom = aCustomExercise()
        .withId('c-1')
        .withPhotos('z.jpg', 'a.jpg')
        .with({
          primaryMuscles: [vocabularyKeyOf('Triceps'), vocabularyKeyOf('Chest')],
          instructions: ['Third', 'First'],
          trackedMetrics: ['reps', 'rpe'],
        })
        .build();

      expect(exerciseFromRow(exerciseToRow(custom))).toEqual({ ok: true, value: custom });
    });

    it.each([
      ['an unknown origin', { origin: 'imported' }, /origin/],
      ['a built-in without source key', { sourceKey: null }, /sourceKey/],
      ['a built-in without level', { level: null }, /level/],
      ['an unknown force', { force: 'twist' }, /force/],
      [
        'a list column that is not JSON',
        { primaryMuscles: '[quad' },
        /primaryMuscles: not valid JSON/,
      ],
      ['a label instead of a key', { category: 'Strength' }, /category/],
      ['an unknown tracked metric', { trackedMetrics: '["speed"]' }, /trackedMetrics/],
      ['custom-shaped images on a built-in', { images: '["a.jpg"]' }, /images/],
      ['a blank name', { name: ' ' }, /name/],
    ])('rejects a row with %s, naming the exercise and the field', (_case, overrides, field) => {
      const decoded = exerciseFromRow(corrupt(overrides));

      expect(decoded).toEqual(failedWith(field));
      expect(decoded).toEqual(failedWith(/exercise "b-1"/));
    });

    it('rejects a custom row whose photos are not app-owned file names', () => {
      const row = { ...exerciseToRow(aCustomExercise().withId('c-1').build()), images: '["../x"]' };

      expect(exerciseFromRow(row)).toEqual(failedWith(/images/));
    });
  });

  describe('builtInExerciseFromRow', () => {
    it('reads a built-in row', () => {
      const squat = aBuiltInExercise().withId('b-1').build();

      expect(builtInExerciseFromRow(exerciseToRow(squat))).toEqual({ ok: true, value: squat });
    });

    it('rejects a custom row, naming the exercise', () => {
      const row = exerciseToRow(aCustomExercise().withId('c-1').build());

      expect(builtInExerciseFromRow(row)).toEqual(failedWith(/exercise "c-1": origin/));
    });
  });

  describe('summaryFromRow', () => {
    it.each([
      ['built-in', aBuiltInExercise().withId('b-1').build()],
      ['custom', aCustomExercise().withId('c-1').withPhotos('a.jpg', 'b.jpg').build()],
      ['custom without photos', aCustomExercise().withId('c-2').build()],
    ])('reads the summary of a %s exercise', (_case, exercise) => {
      expect(summaryFromRow(exerciseToRow(exercise))).toEqual({
        ok: true,
        value: summariseExercise(exercise),
      });
    });

    it('rejects a corrupt summary row, naming the exercise', () => {
      expect(summaryFromRow(corrupt({ equipment: 'Bar Bell' }))).toEqual(
        failedWith(/exercise "b-1": equipment/),
      );
      expect(summaryFromRow(corrupt({ origin: 'imported', images: '[]' }))).toEqual(
        failedWith(/origin/),
      );
    });
  });

  describe('image columns', () => {
    it('reads built-in images and photo file names', () => {
      const squat = aBuiltInExercise().build();

      expect(builtInImagesFromColumn(exerciseToRow(squat).images)).toEqual({
        ok: true,
        value: squat.images,
      });
      expect(photoFileNamesFromColumn('["a.jpg","b.jpg"]')).toEqual({
        ok: true,
        value: ['a.jpg', 'b.jpg'],
      });
    });

    it('rejects image columns that are not JSON', () => {
      expect(builtInImagesFromColumn('{')).toEqual(failedWith(/not valid JSON/));
      expect(photoFileNamesFromColumn('{')).toEqual(failedWith(/not valid JSON/));
    });
  });
});
