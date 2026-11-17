import type { ExerciseListItem } from '../application/exercise-dtos';

/** Presenter of the library list: display text only, no matching rules (S1-16). */

/** "23 exercises", "1 exercise". */
export function resultCountText(count: number): string {
  return count === 1 ? '1 exercise' : `${count} exercises`;
}

/** "Strength · Quadriceps, Glutes" under the name of a row. */
export function rowDetailsText(item: ExerciseListItem): string {
  return [item.categoryLabel, item.primaryMuscleLabels.join(', ')]
    .filter((part) => part.length > 0)
    .join(' · ');
}
