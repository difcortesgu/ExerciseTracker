import { comparisonKey } from './comparison-key';
import type { TrackedMetric } from './tracked-metric';
import type { VocabularyKey } from './vocabulary';

/**
 * Default tracked metrics of built-in exercises (S1-10, decision Q3) as a **Strategy / rule table**:
 * the first rule whose predicate matches decides. Adding a dataset category means adding one rule,
 * not an `if` elsewhere. RPE is never a default (it is optional per set when logging, Sprint 3).
 */
export interface DefaultMetricRule {
  readonly name: string;
  readonly matches: (category: VocabularyKey, equipment: VocabularyKey | null) => boolean;
  readonly metrics: readonly TrackedMetric[];
}

const keys = (...labels: readonly string[]): ReadonlySet<VocabularyKey> =>
  new Set(labels.map(comparisonKey));

const STRENGTH_TYPES = keys('strength', 'powerlifting', 'olympic weightlifting', 'strongman');
const BODY_ONLY = comparisonKey('body only');

const inCategory =
  (category: string) =>
  (candidate: VocabularyKey): boolean =>
    candidate === comparisonKey(category);

const metrics = (...list: readonly TrackedMetric[]): readonly TrackedMetric[] =>
  Object.freeze(list);

export const DEFAULT_METRIC_RULES: readonly DefaultMetricRule[] = Object.freeze<
  readonly DefaultMetricRule[]
>([
  { name: 'cardio', matches: inCategory('cardio'), metrics: metrics('time', 'distance') },
  { name: 'stretching', matches: inCategory('stretching'), metrics: metrics('time') },
  { name: 'plyometrics', matches: inCategory('plyometrics'), metrics: metrics('reps') },
  {
    name: 'strength type, body only',
    matches: (category, equipment) => STRENGTH_TYPES.has(category) && equipment === BODY_ONLY,
    metrics: metrics('reps'),
  },
]);

/** Strength types with any other (or no) equipment, and categories the table does not know. */
export const FALLBACK_METRICS: readonly TrackedMetric[] = metrics('weight', 'reps');

/** The tracked metrics a built-in exercise starts with (S1-10); never empty, never RPE. */
export function defaultTrackedMetrics(
  category: VocabularyKey,
  equipment: VocabularyKey | null,
): readonly TrackedMetric[] {
  const rule = DEFAULT_METRIC_RULES.find((candidate) => candidate.matches(category, equipment));
  return rule?.metrics ?? FALLBACK_METRICS;
}
