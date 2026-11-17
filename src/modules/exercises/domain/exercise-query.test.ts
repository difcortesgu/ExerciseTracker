import * as fc from 'fast-check';

import { anyLibrary, anyQuery, FACET_VALUES, FACETS } from '@test/builders/exercise.arbitrary';
import { anExerciseSummary, vocabularyKeyOf } from '@test/builders/exercise.builder';

import { EMPTY_EXERCISE_QUERY, findMatchingExercises, type ExerciseQuery } from './exercise-query';

const query = (overrides: Partial<ExerciseQuery>): ExerciseQuery => ({
  ...EMPTY_EXERCISE_QUERY,
  ...overrides,
});
const keys = (...labels: readonly string[]) => labels.map(vocabularyKeyOf);
const namesOf = (results: readonly { readonly name: string }[]) => results.map(({ name }) => name);

const barbellSquat = anExerciseSummary().withId('a').named('Barbell Squat').build();
const benchPress = anExerciseSummary()
  .withId('b')
  .named('Bench Press')
  .with({ primaryMuscles: keys('Chest'), equipment: vocabularyKeyOf('Dumbbell') })
  .build();
const pressFrances = anExerciseSummary()
  .withId('c')
  .named('Préss Fráncés')
  .with({
    origin: 'custom',
    category: vocabularyKeyOf('Core'),
    primaryMuscles: keys('Triceps'),
    equipment: vocabularyKeyOf('Sandbag'),
  })
  .build();
const plank = anExerciseSummary()
  .withId('d')
  .named('Plank')
  .with({ primaryMuscles: keys('Abdominals'), equipment: null })
  .build();
const library = [plank, pressFrances, benchPress, barbellSquat];

describe('EMPTY_EXERCISE_QUERY', () => {
  it('has no text and no filters', () => {
    expect(EMPTY_EXERCISE_QUERY).toEqual({ text: '', muscles: [], equipment: [], categories: [] });
  });
});

describe('findMatchingExercises', () => {
  describe('text search', () => {
    it.each(['squat', 'SQUAT', 'squ', 'bar squ', 'squat barbell', '  barbell   squat '])(
      'finds "Barbell Squat" for %p (case-insensitive, partial, any word order)',
      (text) => {
        expect(namesOf(findMatchingExercises(library, query({ text })))).toEqual(['Barbell Squat']);
      },
    );

    it('requires every typed word to appear in the name', () => {
      expect(findMatchingExercises(library, query({ text: 'barbell press' }))).toEqual([]);
    });

    it('is accent-insensitive in both directions', () => {
      expect(namesOf(findMatchingExercises(library, query({ text: 'press frances' })))).toEqual([
        'Préss Fráncés',
      ]);
      expect(namesOf(findMatchingExercises(library, query({ text: 'préss' })))).toEqual([
        'Bench Press',
        'Préss Fráncés',
      ]);
    });

    it('treats whitespace-only text as no query', () => {
      expect(findMatchingExercises(library, query({ text: ' \t ' }))).toHaveLength(library.length);
    });
  });

  describe('filters', () => {
    it('matches any of several values in one facet (OR)', () => {
      const results = findMatchingExercises(
        library,
        query({ muscles: keys('Chest', 'Abdominals') }),
      );

      expect(namesOf(results)).toEqual(['Bench Press', 'Plank']);
    });

    it('matches muscles against primary muscles only (A4)', () => {
      expect(findMatchingExercises(library, query({ muscles: keys('Glutes') }))).toEqual([]);
    });

    it('requires every facet and the text to match (AND)', () => {
      const results = findMatchingExercises(
        library,
        query({ text: 'press', muscles: keys('Chest', 'Triceps'), equipment: keys('Dumbbell') }),
      );

      expect(namesOf(results)).toEqual(['Bench Press']);
    });

    it('treats a user-defined value like a built-in one', () => {
      const results = findMatchingExercises(
        library,
        query({ equipment: keys('Sandbag', 'Barbell'), categories: keys('Core') }),
      );

      expect(namesOf(results)).toEqual(['Préss Fráncés']);
    });

    it('never matches an exercise without equipment by an equipment filter', () => {
      const results = findMatchingExercises(
        library,
        query({ equipment: keys('Barbell', 'Dumbbell', 'Sandbag') }),
      );

      expect(namesOf(results)).not.toContain('Plank');
    });

    it('filters by category', () => {
      expect(
        namesOf(findMatchingExercises(library, query({ categories: keys('Strength') }))),
      ).toEqual(['Barbell Squat', 'Bench Press', 'Plank']);
    });
  });

  describe('order', () => {
    it('sorts alphabetically, case- and accent-insensitively', () => {
      const lower = anExerciseSummary().withId('x').named('arnold press').build();
      const accented = anExerciseSummary().withId('y').named('Ábdominal crunch').build();

      expect(
        namesOf(findMatchingExercises([barbellSquat, lower, accented], EMPTY_EXERCISE_QUERY)),
      ).toEqual(['Ábdominal crunch', 'arnold press', 'Barbell Squat']);
    });

    it('breaks ties between equal names by id, so the order is stable', () => {
      const second = anExerciseSummary().withId('2').named('Squat').build();
      const first = anExerciseSummary().withId('1').named('squat').build();

      expect(findMatchingExercises([second, first], EMPTY_EXERCISE_QUERY)).toEqual([first, second]);
    });

    it('returns a new frozen list and leaves the library unchanged', () => {
      const input = [...library];

      const results = findMatchingExercises(input, EMPTY_EXERCISE_QUERY);

      expect(Object.isFrozen(results)).toBe(true);
      expect(input).toEqual(library);
    });
  });

  describe('properties', () => {
    it('returns only exercises of the library, each once', () => {
      fc.assert(
        fc.property(anyLibrary, anyQuery, (exercises, anyFilter) => {
          const results = findMatchingExercises(exercises, anyFilter);

          results.forEach((result) => expect(exercises).toContain(result));
          expect(new Set(results).size).toBe(results.length);
        }),
      );
    });

    it('returns the whole library for an empty query', () => {
      fc.assert(
        fc.property(anyLibrary, (exercises) => {
          expect(findMatchingExercises(exercises, EMPTY_EXERCISE_QUERY)).toHaveLength(
            exercises.length,
          );
        }),
      );
    });

    it('is idempotent: searching the results again changes nothing', () => {
      fc.assert(
        fc.property(anyLibrary, anyQuery, (exercises, anyFilter) => {
          const once = findMatchingExercises(exercises, anyFilter);

          expect(findMatchingExercises(once, anyFilter)).toEqual(once);
        }),
      );
    });

    it('never removes results when a value is added to a non-empty facet', () => {
      fc.assert(
        fc.property(
          anyLibrary,
          anyQuery,
          fc.constantFrom(...FACETS),
          fc.nat(),
          (exercises, anyFilter, facet, pick) => {
            fc.pre(anyFilter[facet].length > 0);
            const values = FACET_VALUES[facet];
            const added = values[pick % values.length] ?? values[0];
            fc.pre(added !== undefined);
            const wider = { ...anyFilter, [facet]: [...anyFilter[facet], added] };

            const before = findMatchingExercises(exercises, anyFilter);
            const after = findMatchingExercises(exercises, wider);

            before.forEach((result) => expect(after).toContain(result));
          },
        ),
      );
    });

    it('never adds results when a facet is added', () => {
      fc.assert(
        fc.property(
          anyLibrary,
          anyQuery,
          fc.constantFrom(...FACETS),
          (exercises, anyFilter, facet) => {
            const without = { ...anyFilter, [facet]: [] };

            const narrower = findMatchingExercises(exercises, anyFilter);
            const wider = findMatchingExercises(exercises, without);

            narrower.forEach((result) => expect(wider).toContain(result));
          },
        ),
      );
    });
  });
});
