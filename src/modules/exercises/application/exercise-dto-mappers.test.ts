import { aPhotoView } from '@test/builders/exercise-dtos.builder';
import {
  aBuiltInExercise,
  aCustomExercise,
  anExerciseSummary,
  aVocabularyValue,
  builtInVocabularyValues,
  vocabularyKeyOf,
} from '@test/builders/exercise.builder';

import { mergeVocabulary } from '../domain/vocabulary';

import {
  optionFor,
  toExerciseDetails,
  toExerciseFormValues,
  toExerciseListItem,
  toVocabularyOptions,
} from './exercise-dto-mappers';

const sandbag = aVocabularyValue().labelled('Sandbag').custom().build();
const vocabulary = mergeVocabulary([...builtInVocabularyValues(), sandbag]);

describe('optionFor', () => {
  it('resolves a key to its label and marks user-defined values', () => {
    expect(optionFor(vocabulary, 'equipment', vocabularyKeyOf('Barbell'))).toEqual({
      key: 'barbell',
      label: 'Barbell',
      isCustom: false,
    });
    expect(optionFor(vocabulary, 'equipment', sandbag.key)).toEqual({
      key: 'sandbag',
      label: 'Sandbag',
      isCustom: true,
    });
  });

  it('shows the key itself when no label is stored', () => {
    expect(optionFor(vocabulary, 'muscle', vocabularyKeyOf('Wings'))).toEqual({
      key: 'wings',
      label: 'wings',
      isCustom: false,
    });
  });
});

describe('toVocabularyOptions', () => {
  it('maps every kind in the merged order', () => {
    const options = toVocabularyOptions(vocabulary);

    expect(options.equipment.map(({ label }) => label)).toEqual([
      'Barbell',
      'Body only',
      'Dumbbell',
      'Kettlebells',
      'Sandbag',
    ]);
    expect(options.category[0]).toEqual({ key: 'cardio', label: 'Cardio', isCustom: false });
    expect(options.muscle).toHaveLength(6);
  });
});

describe('toExerciseListItem', () => {
  it('maps a summary to a row with labels', () => {
    const summary = anExerciseSummary().withId('b-1').build();

    expect(toExerciseListItem(summary, vocabulary)).toEqual({
      id: 'b-1',
      name: 'Barbell Squat',
      isCustom: false,
      categoryLabel: 'Strength',
      primaryMuscleLabels: ['Quadriceps'],
      equipmentLabel: 'Barbell',
      coverImage: summary.coverImage,
    });
  });

  it('marks custom exercises and maps missing equipment to null', () => {
    const summary = anExerciseSummary().with({ origin: 'custom', equipment: null }).build();

    expect(toExerciseListItem(summary, vocabulary)).toMatchObject({
      isCustom: true,
      equipmentLabel: null,
    });
  });
});

describe('toExerciseDetails', () => {
  it('maps a built-in with its built-in attributes', () => {
    const exercise = aBuiltInExercise().withId('b-1').build();

    expect(toExerciseDetails(exercise, vocabulary)).toEqual({
      id: 'b-1',
      name: 'Barbell Squat',
      isCustom: false,
      category: { key: 'strength', label: 'Strength', isCustom: false },
      primaryMuscles: [{ key: 'quadriceps', label: 'Quadriceps', isCustom: false }],
      secondaryMuscles: [
        { key: 'glutes', label: 'Glutes', isCustom: false },
        { key: 'hamstrings', label: 'Hamstrings', isCustom: false },
      ],
      equipment: { key: 'barbell', label: 'Barbell', isCustom: false },
      instructions: exercise.instructions,
      images: exercise.images,
      trackedMetrics: ['weight', 'reps'],
      builtIn: { level: 'beginner', force: 'push', mechanic: 'compound' },
    });
  });

  it('maps a custom exercise without built-in attributes', () => {
    const exercise = aCustomExercise().with({ equipment: null }).withPhotos('a.jpg').build();

    expect(toExerciseDetails(exercise, vocabulary)).toMatchObject({
      isCustom: true,
      equipment: null,
      builtIn: null,
      images: [{ kind: 'photo', fileName: 'a.jpg' }],
    });
  });
});

describe('toExerciseFormValues', () => {
  it('maps an exercise to form values with the given photos and joined instructions', () => {
    const exercise = aCustomExercise().withPhotos('a.jpg').build();

    expect(toExerciseFormValues(exercise, vocabulary, [aPhotoView('a.jpg')])).toEqual({
      name: 'My Goblet Squat',
      category: { key: 'strength', label: 'Strength', isCustom: false },
      primaryMuscles: [{ key: 'quadriceps', label: 'Quadriceps', isCustom: false }],
      secondaryMuscles: [{ key: 'glutes', label: 'Glutes', isCustom: false }],
      equipment: { key: 'kettlebells', label: 'Kettlebells', isCustom: false },
      instructionsText: 'Hold the kettlebell at your chest.\nSquat down and stand up.',
      photos: [aPhotoView('a.jpg')],
      trackedMetrics: ['weight', 'reps'],
    });
  });

  it('maps missing equipment to null', () => {
    const exercise = aCustomExercise().with({ equipment: null }).build();

    expect(toExerciseFormValues(exercise, vocabulary, []).equipment).toBeNull();
  });
});
