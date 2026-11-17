import { comparisonKey } from './comparison-key';
import type { ExerciseSummary } from './exercise-summary';
import type { VocabularyKey } from './vocabulary';

/**
 * Search text plus facet filters for the library (S1-09, ADR-004 T1). Matching runs in memory
 * over the active summaries, as pure domain functions.
 *
 * Implemented in this file — **Specification** pattern (one named predicate per
 * facet, composed with AND):
 * - text: every whitespace-separated word of `comparisonKey(text)` is a substring of
 *   `comparisonKey(name)`, any order; blank text matches everything;
 * - each facet: empty = no filter; otherwise the exercise has **any** of the values (OR);
 *   `muscles` matches primary muscles only (A4); `equipment: null` never matches a value;
 * - `findMatchingExercises<T extends ExerciseSummary>(library: readonly T[], query): readonly T[]`
 *   filters then sorts by `comparisonKey(name)`, ties by id (stable; idempotent).
 * Property tests: results ⊆ library; empty query = whole library; adding a value to a facet never
 * removes results; adding a facet never adds results.
 */
export interface ExerciseQuery {
  readonly text: string;
  readonly muscles: readonly VocabularyKey[];
  readonly equipment: readonly VocabularyKey[];
  readonly categories: readonly VocabularyKey[];
}

/** No text, no filters: the whole active library. */
export const EMPTY_EXERCISE_QUERY: ExerciseQuery = Object.freeze({
  text: '',
  muscles: Object.freeze([]),
  equipment: Object.freeze([]),
  categories: Object.freeze([]),
});

/** Specification: a named predicate over a summary; specifications compose with `allOf`. */
type ExerciseSpecification = (summary: ExerciseSummary) => boolean;

const WORD_SEPARATOR = ' ';

/** Every word of the text is part of the name (comparison keys: case/accent-insensitive). */
function nameContainsEveryWord(text: string): ExerciseSpecification {
  const words = comparisonKey(text)
    .split(WORD_SEPARATOR)
    .filter((word) => word.length > 0);
  return (summary) => {
    const name = comparisonKey(summary.name);
    return words.every((word) => name.includes(word));
  };
}

/** An empty facet matches everything; otherwise the exercise has any of the values (OR). */
function hasAnyOf(
  selected: readonly VocabularyKey[],
  valuesOf: (summary: ExerciseSummary) => readonly VocabularyKey[],
): ExerciseSpecification {
  const wanted = new Set(selected);
  return (summary) => wanted.size === 0 || valuesOf(summary).some((value) => wanted.has(value));
}

const primaryMusclesOf = (summary: ExerciseSummary) => summary.primaryMuscles;
const equipmentOf = (summary: ExerciseSummary) =>
  summary.equipment === null ? [] : [summary.equipment];
const categoryOf = (summary: ExerciseSummary) => [summary.category];

function allOf(specifications: readonly ExerciseSpecification[]): ExerciseSpecification {
  return (summary) => specifications.every((specification) => specification(summary));
}

function specificationFor(query: ExerciseQuery): ExerciseSpecification {
  return allOf([
    nameContainsEveryWord(query.text),
    hasAnyOf(query.muscles, primaryMusclesOf),
    hasAnyOf(query.equipment, equipmentOf),
    hasAnyOf(query.categories, categoryOf),
  ]);
}

/** Locale-independent code-unit order (stable on every device). */
function compareText(first: string, second: string): number {
  if (first === second) return 0;
  return first < second ? -1 : 1;
}

/**
 * The exercises matching the query (S1-09), alphabetical by comparison key of the name, ties by
 * id (stable and idempotent). Works on any summary type, e.g. list items carrying more fields.
 */
export function findMatchingExercises<T extends ExerciseSummary>(
  library: readonly T[],
  query: ExerciseQuery,
): readonly T[] {
  return Object.freeze(
    library
      .filter(specificationFor(query))
      .map((summary) => ({ summary, sortKey: comparisonKey(summary.name) }))
      .sort(
        (first, second) =>
          compareText(first.sortKey, second.sortKey) ||
          compareText(first.summary.id, second.summary.id),
      )
      .map(({ summary }) => summary),
  );
}
