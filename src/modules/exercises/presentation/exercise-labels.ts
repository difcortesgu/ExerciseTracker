import type { ExerciseForce, ExerciseLevel, ExerciseMechanic } from '../domain/exercise';
import type { TrackedMetric } from '../domain/tracked-metric';

/**
 * Display labels of the closed exercise attributes (S1-17, S1-19). Exhaustive records: adding a
 * metric to the `TRACKED_METRICS` registry fails type-checking until it has a label here.
 */
export const TRACKED_METRIC_LABELS: Readonly<Record<TrackedMetric, string>> = Object.freeze({
  weight: 'Weight',
  reps: 'Reps',
  time: 'Time',
  distance: 'Distance',
  rpe: 'RPE',
});

export const LEVEL_LABELS: Readonly<Record<ExerciseLevel, string>> = Object.freeze({
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  expert: 'Expert',
});

export const FORCE_LABELS: Readonly<Record<ExerciseForce, string>> = Object.freeze({
  pull: 'Pull',
  push: 'Push',
  static: 'Static',
});

export const MECHANIC_LABELS: Readonly<Record<ExerciseMechanic, string>> = Object.freeze({
  compound: 'Compound',
  isolation: 'Isolation',
});

/** "Weight, Reps" — in the order given (the domain keeps metrics in canonical order). */
export function trackedMetricsText(metrics: readonly TrackedMetric[]): string {
  return metrics.map((metric) => TRACKED_METRIC_LABELS[metric]).join(', ');
}
