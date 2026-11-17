import {
  anExerciseDetails,
  anExerciseFormValues,
  anExerciseListItem,
  aPhotoView,
  aVocabularyOption,
} from './exercise-dtos.builder';

describe('exercise DTO builders', () => {
  describe('aVocabularyOption', () => {
    it('builds the built-in option "Barbell" by default, keyed by its label', () => {
      expect(aVocabularyOption().build()).toEqual({
        key: 'barbell',
        label: 'Barbell',
        isCustom: false,
      });
    });

    it('builds a user-defined option with another label', () => {
      expect(aVocabularyOption().labelled('Sandbag').custom().build()).toEqual({
        key: 'sandbag',
        label: 'Sandbag',
        isCustom: true,
      });
    });
  });

  describe('anExerciseListItem', () => {
    it('builds the row of the built-in "Barbell Squat" by default', () => {
      expect(anExerciseListItem().build()).toMatchObject({
        name: 'Barbell Squat',
        isCustom: false,
        categoryLabel: 'Strength',
        primaryMuscleLabels: ['Quadriceps'],
        equipmentLabel: 'Barbell',
        coverImage: { kind: 'builtIn', path: 'Barbell_Squat/0.jpg' },
      });
    });

    it('gives each row its own id and overrides fields', () => {
      const custom = anExerciseListItem()
        .withId('custom-1')
        .named('My Goblet Squat')
        .with({ isCustom: true, coverImage: null })
        .build();

      expect(custom).toMatchObject({ id: 'custom-1', name: 'My Goblet Squat', isCustom: true });
      expect(anExerciseListItem().build().id).not.toBe(anExerciseListItem().build().id);
    });
  });

  describe('anExerciseDetails', () => {
    it('builds the detail of the built-in "Barbell Squat" by default', () => {
      const details = anExerciseDetails().build();

      expect(details).toMatchObject({
        name: 'Barbell Squat',
        isCustom: false,
        category: { key: 'strength', label: 'Strength', isCustom: false },
        primaryMuscles: [{ key: 'quadriceps', label: 'Quadriceps', isCustom: false }],
        equipment: { key: 'barbell', label: 'Barbell', isCustom: false },
        trackedMetrics: ['weight', 'reps'],
        builtIn: { level: 'beginner', force: 'push', mechanic: 'compound' },
      });
      expect(details.images).toHaveLength(2);
      expect(details.instructions.length).toBeGreaterThan(0);
    });

    it('builds the detail of a custom exercise with photos', () => {
      const details = anExerciseDetails().custom().withPhotos('a.jpg').withId('c-1').build();

      expect(details).toMatchObject({
        id: 'c-1',
        isCustom: true,
        builtIn: null,
        images: [{ kind: 'photo', fileName: 'a.jpg' }],
      });
    });

    it('overrides fields', () => {
      expect(anExerciseDetails().named('Plank').with({ images: [] }).build()).toMatchObject({
        name: 'Plank',
        images: [],
      });
    });
  });

  describe('aPhotoView', () => {
    it('builds a photo with a file URI in app storage', () => {
      expect(aPhotoView('a.jpg')).toEqual({
        fileName: 'a.jpg',
        uri: 'file:///data/user/0/app/files/exercise-photos/a.jpg',
      });
    });
  });

  describe('anExerciseFormValues', () => {
    it('builds the edit prefill of "My Goblet Squat" by default', () => {
      expect(anExerciseFormValues().build()).toMatchObject({
        name: 'My Goblet Squat',
        category: { key: 'strength', label: 'Strength' },
        primaryMuscles: [{ key: 'quadriceps' }],
        equipment: { key: 'kettlebells', label: 'Kettlebells' },
        instructionsText: 'Hold the kettlebell at your chest.\nSquat down and stand up.',
        photos: [],
        trackedMetrics: ['weight', 'reps'],
      });
    });

    it('adds photos and overrides fields', () => {
      const values = anExerciseFormValues()
        .withPhotos('a.jpg')
        .with({ name: 'Barbell Squat (custom)', equipment: null })
        .build();

      expect(values).toMatchObject({
        name: 'Barbell Squat (custom)',
        equipment: null,
        photos: [aPhotoView('a.jpg')],
      });
    });
  });
});
