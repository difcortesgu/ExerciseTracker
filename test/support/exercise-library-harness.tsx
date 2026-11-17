import { ok } from '@shared/domain/result';
import {
  exerciseContainer,
  libraryItems,
  renderExerciseApp,
} from '@test/support/exercise-screen-harness';

import type {
  ExerciseListItem,
  ExerciseSearchQuery,
} from '@modules/exercises/application/exercise-dtos';
import type { FindExercises } from '@modules/exercises/application/find-exercises';

/**
 * Test harness of the library screen (S1-16): a `FindExercises` stub that records the queries and
 * answers by name (it stands in for the use case; the real matching rules are the domain's).
 */

/** FindExercises that answers with the items whose name contains the search text. */
export function searchingFind(items: readonly ExerciseListItem[] = libraryItems) {
  const queries: ExerciseSearchQuery[] = [];
  const findExercises: FindExercises = (query) => {
    queries.push(query);
    const text = query.text.toLowerCase();
    const filtered = query.muscles.length > 0 ? items.slice(0, 1) : items;
    return Promise.resolve(ok(filtered.filter((item) => item.name.toLowerCase().includes(text))));
  };
  return { findExercises, queries };
}

export async function renderLibrary(findExercises: FindExercises = searchingFind().findExercises) {
  return renderExerciseApp(exerciseContainer({ findExercises }));
}
