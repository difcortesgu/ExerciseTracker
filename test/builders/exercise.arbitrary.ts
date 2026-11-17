import * as fc from 'fast-check';

import type { ExerciseQuery } from '@modules/exercises/domain/exercise-query';
import type { ExerciseSummary } from '@modules/exercises/domain/exercise-summary';
import type { VocabularyKey } from '@modules/exercises/domain/vocabulary';

import { anExerciseSummary, vocabularyKeyOf } from './exercise.builder';

/**
 * fast-check arbitraries for the library search (S1-09): small vocabularies and names built from
 * a few words (with case and accent variants), so random queries actually hit and miss.
 */

const WORDS = ['Barbell', 'squat', 'Préss', 'press', 'Curl', 'Bench', 'Row', 'FRONT'];
const CATEGORIES = ['Strength', 'Cardio', 'Stretching', 'Core'].map(vocabularyKeyOf);
const MUSCLES = ['Quadriceps', 'Glutes', 'Chest', 'Biceps', 'Serratus'].map(vocabularyKeyOf);
const EQUIPMENT = ['Barbell', 'Dumbbell', 'Body only', 'Sandbag'].map(vocabularyKeyOf);

const keysFrom = (values: readonly VocabularyKey[]) =>
  fc.uniqueArray(fc.constantFrom(...values), { maxLength: 3 });

export const anyName = fc
  .array(fc.constantFrom(...WORDS), { minLength: 1, maxLength: 3 })
  .map((words) => words.join(' '));

export const anySummary: fc.Arbitrary<ExerciseSummary> = fc
  .record({
    id: fc.integer({ min: 1, max: 1_000 }),
    name: anyName,
    category: fc.constantFrom(...CATEGORIES),
    primaryMuscles: keysFrom(MUSCLES),
    equipment: fc.option(fc.constantFrom(...EQUIPMENT)),
    isCustom: fc.boolean(),
  })
  .map(({ id, name, category, primaryMuscles, equipment, isCustom }) =>
    anExerciseSummary()
      .withId(`exercise-${id}`)
      .named(name)
      .with({ category, primaryMuscles, equipment, origin: isCustom ? 'custom' : 'builtIn' })
      .build(),
  );

/** A library: summaries with unique ids (as the reader returns them). */
export const anyLibrary = fc.uniqueArray(anySummary, {
  selector: (summary) => summary.id,
  maxLength: 25,
});

export const anyQuery: fc.Arbitrary<ExerciseQuery> = fc.record({
  text: fc.oneof(fc.constant(''), fc.constant('  '), fc.constantFrom(...WORDS), anyName),
  muscles: keysFrom(MUSCLES),
  equipment: keysFrom(EQUIPMENT),
  categories: keysFrom(CATEGORIES),
});

export const FACETS = ['muscles', 'equipment', 'categories'] as const;
export const FACET_VALUES = { muscles: MUSCLES, equipment: EQUIPMENT, categories: CATEGORIES };
