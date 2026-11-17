import { comparisonKey } from '@modules/exercises/domain/comparison-key';

import {
  aBuiltInExercise,
  aCustomExercise,
  anExerciseSummary,
  aVocabularyValue,
  builtInVocabularyValues,
  vocabularyKeyOf,
} from './exercise.builder';

describe('exercise builders', () => {
  describe('vocabularyKeyOf', () => {
    it('is the comparison key of the label (no casts)', () => {
      expect(vocabularyKeyOf('Body only')).toBe(comparisonKey('body ONLY'));
    });
  });

  describe('aBuiltInExercise', () => {
    it('builds an active built-in "Barbell Squat" with dataset images by default', () => {
      const exercise = aBuiltInExercise().build();

      expect(exercise).toMatchObject({
        origin: 'builtIn',
        name: 'Barbell Squat',
        sourceKey: 'Barbell_Squat',
        category: 'strength',
        primaryMuscles: ['quadriceps'],
        equipment: 'barbell',
        level: 'beginner',
        trackedMetrics: ['weight', 'reps'],
        archived: false,
      });
      expect(exercise.images.map((image) => image.path)).toEqual([
        'Barbell_Squat/0.jpg',
        'Barbell_Squat/1.jpg',
      ]);
    });

    it('gives every built exercise its own deterministic id', () => {
      expect(aBuiltInExercise().build().id).not.toBe(aBuiltInExercise().build().id);
      expect(aBuiltInExercise().withId('squat').build().id).toBe('squat');
    });

    it('derives the source key and image paths from a new name', () => {
      const exercise = aBuiltInExercise().named('Front Squat').build();

      expect(exercise.sourceKey).toBe('Front_Squat');
      expect(exercise.images[0]?.path).toBe('Front_Squat/0.jpg');
    });

    it('overrides fields, archives, and returns frozen exercises', () => {
      const exercise = aBuiltInExercise().with({ equipment: null, images: [] }).archived().build();

      expect(exercise).toMatchObject({ equipment: null, images: [], archived: true });
      expect(Object.isFrozen(exercise)).toBe(true);
    });

    it('is immutable: every method returns a new builder', () => {
      const base = aBuiltInExercise();

      base.named('Changed').archived();

      expect(base.build()).toMatchObject({ name: 'Barbell Squat', archived: false });
    });

    it('builds the seed data of the exercise', () => {
      const data = aBuiltInExercise().named('Deadlift').buildData();

      expect(data).toMatchObject({ sourceKey: 'Deadlift', name: 'Deadlift' });
      expect(data).not.toHaveProperty('id');
      expect(data).not.toHaveProperty('trackedMetrics');
    });
  });

  describe('aCustomExercise', () => {
    it('builds an active custom "My Goblet Squat" without photos by default', () => {
      expect(aCustomExercise().build()).toMatchObject({
        origin: 'custom',
        name: 'My Goblet Squat',
        images: [],
        trackedMetrics: ['weight', 'reps'],
        archived: false,
      });
    });

    it('attaches photos by file name and can be archived', () => {
      const exercise = aCustomExercise().withPhotos('a.jpg', 'b.jpg').archived().build();

      expect(exercise.images).toEqual([
        { kind: 'photo', fileName: 'a.jpg' },
        { kind: 'photo', fileName: 'b.jpg' },
      ]);
      expect(exercise.archived).toBe(true);
    });

    it('overrides the name, id and any other field', () => {
      const exercise = aCustomExercise()
        .named('Sandbag Carry')
        .withId('custom-1')
        .with({ equipment: vocabularyKeyOf('Sandbag') })
        .build();

      expect(exercise).toMatchObject({
        id: 'custom-1',
        name: 'Sandbag Carry',
        equipment: 'sandbag',
      });
    });
  });

  describe('anExerciseSummary', () => {
    it('builds the summary of the default built-in', () => {
      expect(anExerciseSummary().build()).toMatchObject({
        name: 'Barbell Squat',
        origin: 'builtIn',
        category: 'strength',
        primaryMuscles: ['quadriceps'],
        equipment: 'barbell',
        coverImage: { kind: 'builtIn', path: 'Barbell_Squat/0.jpg' },
      });
    });

    it('overrides fields', () => {
      const summary = anExerciseSummary()
        .named('Plank')
        .withId('plank')
        .with({ origin: 'custom', coverImage: null })
        .build();

      expect(summary).toMatchObject({
        id: 'plank',
        name: 'Plank',
        origin: 'custom',
        coverImage: null,
      });
    });
  });

  describe('aVocabularyValue', () => {
    it('builds the built-in equipment value "Barbell" by default', () => {
      expect(aVocabularyValue().build()).toEqual({
        kind: 'equipment',
        key: 'barbell',
        label: 'Barbell',
        origin: 'builtIn',
      });
    });

    it('builds a user-defined value of another kind, keyed by its label', () => {
      expect(
        aVocabularyValue().ofKind('muscle').labelled('Serratus Anterior').custom().build(),
      ).toEqual({
        kind: 'muscle',
        key: 'serratus anterior',
        label: 'Serratus Anterior',
        origin: 'custom',
      });
    });
  });
});

describe('builtInVocabularyValues', () => {
  it('lists the built-in values the exercise builders use, one per kind and key', () => {
    const values = builtInVocabularyValues();
    const ids = values.map(({ kind, key }) => `${kind}:${key}`);

    expect(new Set(ids).size).toBe(ids.length);
    expect(values.every(({ origin }) => origin === 'builtIn')).toBe(true);
    expect(ids).toEqual(
      expect.arrayContaining([
        'category:strength',
        'muscle:quadriceps',
        'muscle:glutes',
        'muscle:hamstrings',
        'equipment:barbell',
        'equipment:kettlebells',
      ]),
    );
  });
});
