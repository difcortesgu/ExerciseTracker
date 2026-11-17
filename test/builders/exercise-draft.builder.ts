import type { ExerciseDraft } from '@modules/exercises/domain/exercise-draft';
import type { VocabularySelection } from '@modules/exercises/domain/vocabulary';

import { aCustomPhoto, vocabularyKeyOf } from './exercise.builder';

/** An existing vocabulary value selected by its label's key, e.g. `existing('Barbell')`. */
export const existing = (label: string): VocabularySelection =>
  Object.freeze({ source: 'existing', key: vocabularyKeyOf(label) });

/** A value typed with "Add your own" (S1-29), e.g. `newValue('Sandbag')`. */
export const newValue = (label: string): VocabularySelection =>
  Object.freeze({ source: 'new', label });

/** Builder of what the custom-exercise form submits (S1-19); valid by default. */
export class ExerciseDraftBuilder {
  constructor(private readonly fields: ExerciseDraft) {}

  with(overrides: Partial<ExerciseDraft>): ExerciseDraftBuilder {
    return new ExerciseDraftBuilder({ ...this.fields, ...overrides });
  }

  named(name: string): ExerciseDraftBuilder {
    return this.with({ name });
  }

  withPhotos(...fileNames: readonly string[]): ExerciseDraftBuilder {
    return this.with({
      photos: Object.freeze(fileNames.map((fileName) => aCustomPhoto(fileName).fileName)),
    });
  }

  build(): ExerciseDraft {
    return Object.freeze({ ...this.fields });
  }
}

export const anExerciseDraft = (): ExerciseDraftBuilder =>
  new ExerciseDraftBuilder({
    name: 'My Goblet Squat',
    category: existing('Strength'),
    primaryMuscles: Object.freeze([existing('Quadriceps')]),
    secondaryMuscles: Object.freeze([existing('Glutes')]),
    equipment: existing('Kettlebells'),
    instructionsText: 'Hold the kettlebell at your chest.\nSquat down and stand up.',
    photos: Object.freeze([]),
    trackedMetrics: Object.freeze(['weight', 'reps'] as const),
  });
