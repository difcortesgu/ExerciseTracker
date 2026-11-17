/**
 * What the sets of an exercise record (PLAN §1 "Metrics logged", S1-08, S1-10).
 *
 * **Registry** of metrics in canonical order `weight, reps, time, distance, rpe`: an exercise stores
 * each metric at most once, in that order, whatever order the user picked them in. Adding a metric
 * later is one entry here plus its label in presentation, never a branch elsewhere (Open/Closed).
 */
export const TRACKED_METRICS = Object.freeze([
  'weight',
  'reps',
  'time',
  'distance',
  'rpe',
] as const);

export type TrackedMetric = (typeof TRACKED_METRICS)[number];

/** De-duplicated, in canonical (registry) order; never fails (an empty list is validated later). */
export function normaliseTrackedMetrics(
  metrics: readonly TrackedMetric[],
): readonly TrackedMetric[] {
  const chosen = new Set(metrics);
  return Object.freeze(TRACKED_METRICS.filter((metric) => chosen.has(metric)));
}
