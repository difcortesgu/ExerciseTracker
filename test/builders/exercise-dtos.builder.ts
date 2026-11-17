import type {
  ExerciseDetails,
  ExerciseFormValues,
  ExerciseListItem,
  PhotoView,
  VocabularyOption,
} from '@modules/exercises/application/exercise-dtos';

import { nextId } from './builder-support';
import { aBuiltInImage, aCustomPhoto, exerciseIdOf, vocabularyKeyOf } from './exercise.builder';

/**
 * Builders of the exercises DTOs that presentation receives (Sprint 1). Defaults mirror the domain
 * builders ("Barbell Squat" built-in, "My Goblet Squat" custom) with display labels resolved.
 * Every method returns a new builder.
 */

/** Where the fakes and builders pretend the app's photo folder is. */
export const PHOTO_DIRECTORY_URI = 'file:///data/user/0/app/files/exercise-photos';

export const aPhotoView = (fileName: string): PhotoView =>
  Object.freeze({
    fileName: aCustomPhoto(fileName).fileName,
    uri: `${PHOTO_DIRECTORY_URI}/${fileName}`,
  });

export class VocabularyOptionBuilder {
  constructor(private readonly fields: VocabularyOption) {}

  labelled(label: string): VocabularyOptionBuilder {
    return new VocabularyOptionBuilder({ ...this.fields, label, key: vocabularyKeyOf(label) });
  }

  custom(): VocabularyOptionBuilder {
    return new VocabularyOptionBuilder({ ...this.fields, isCustom: true });
  }

  build(): VocabularyOption {
    return Object.freeze({ ...this.fields });
  }
}

export const aVocabularyOption = (): VocabularyOptionBuilder =>
  new VocabularyOptionBuilder({
    key: vocabularyKeyOf('Barbell'),
    label: 'Barbell',
    isCustom: false,
  });

const option = (label: string): VocabularyOption => aVocabularyOption().labelled(label).build();

const nextListId = () => exerciseIdOf(nextId('exercise'));

export class ExerciseListItemBuilder {
  constructor(private readonly fields: ExerciseListItem) {}

  with(overrides: Partial<ExerciseListItem>): ExerciseListItemBuilder {
    return new ExerciseListItemBuilder({ ...this.fields, ...overrides });
  }

  withId(id: string): ExerciseListItemBuilder {
    return this.with({ id: exerciseIdOf(id) });
  }

  named(name: string): ExerciseListItemBuilder {
    return this.with({ name });
  }

  build(): ExerciseListItem {
    return Object.freeze({ ...this.fields });
  }
}

export const anExerciseListItem = (): ExerciseListItemBuilder =>
  new ExerciseListItemBuilder({
    id: nextListId(),
    name: 'Barbell Squat',
    isCustom: false,
    categoryLabel: 'Strength',
    primaryMuscleLabels: Object.freeze(['Quadriceps']),
    equipmentLabel: 'Barbell',
    coverImage: aBuiltInImage('Barbell_Squat/0.jpg'),
  });

export class ExerciseDetailsBuilder {
  constructor(private readonly fields: ExerciseDetails) {}

  with(overrides: Partial<ExerciseDetails>): ExerciseDetailsBuilder {
    return new ExerciseDetailsBuilder({ ...this.fields, ...overrides });
  }

  withId(id: string): ExerciseDetailsBuilder {
    return this.with({ id: exerciseIdOf(id) });
  }

  named(name: string): ExerciseDetailsBuilder {
    return this.with({ name });
  }

  /** A custom exercise: no built-in attributes and no dataset images. */
  custom(): ExerciseDetailsBuilder {
    return this.with({ isCustom: true, builtIn: null, images: Object.freeze([]) });
  }

  withPhotos(...fileNames: readonly string[]): ExerciseDetailsBuilder {
    return this.with({ images: Object.freeze(fileNames.map(aCustomPhoto)) });
  }

  build(): ExerciseDetails {
    return Object.freeze({ ...this.fields });
  }
}

export const anExerciseDetails = (): ExerciseDetailsBuilder =>
  new ExerciseDetailsBuilder({
    id: nextListId(),
    name: 'Barbell Squat',
    isCustom: false,
    category: option('Strength'),
    primaryMuscles: Object.freeze([option('Quadriceps')]),
    secondaryMuscles: Object.freeze([option('Glutes'), option('Hamstrings')]),
    equipment: option('Barbell'),
    instructions: Object.freeze([
      'Set the bar on your upper back and stand with your feet shoulder-width apart.',
      'Squat down until your thighs are parallel to the floor, then stand back up.',
    ]),
    images: Object.freeze([
      aBuiltInImage('Barbell_Squat/0.jpg'),
      aBuiltInImage('Barbell_Squat/1.jpg'),
    ]),
    trackedMetrics: Object.freeze(['weight', 'reps'] as const),
    builtIn: Object.freeze({ level: 'beginner', force: 'push', mechanic: 'compound' }),
  });

export class ExerciseFormValuesBuilder {
  constructor(private readonly fields: ExerciseFormValues) {}

  with(overrides: Partial<ExerciseFormValues>): ExerciseFormValuesBuilder {
    return new ExerciseFormValuesBuilder({ ...this.fields, ...overrides });
  }

  withPhotos(...fileNames: readonly string[]): ExerciseFormValuesBuilder {
    return this.with({ photos: Object.freeze(fileNames.map(aPhotoView)) });
  }

  build(): ExerciseFormValues {
    return Object.freeze({ ...this.fields });
  }
}

export const anExerciseFormValues = (): ExerciseFormValuesBuilder =>
  new ExerciseFormValuesBuilder({
    name: 'My Goblet Squat',
    category: option('Strength'),
    primaryMuscles: Object.freeze([option('Quadriceps')]),
    secondaryMuscles: Object.freeze([option('Glutes')]),
    equipment: option('Kettlebells'),
    instructionsText: 'Hold the kettlebell at your chest.\nSquat down and stand up.',
    photos: Object.freeze([]),
    trackedMetrics: Object.freeze(['weight', 'reps'] as const),
  });
