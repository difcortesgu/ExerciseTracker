import { TRACKED_METRICS } from '../domain/tracked-metric';

import {
  FORCE_LABELS,
  LEVEL_LABELS,
  MECHANIC_LABELS,
  TRACKED_METRIC_LABELS,
  trackedMetricsText,
} from './exercise-labels';

describe('exercise labels', () => {
  it('names every tracked metric of the registry, so a new metric cannot ship without a label', () => {
    expect(TRACKED_METRICS.map((metric) => TRACKED_METRIC_LABELS[metric])).toEqual([
      'Weight',
      'Reps',
      'Time',
      'Distance',
      'RPE',
    ]);
  });

  it('names levels, forces and mechanics in sentence case', () => {
    expect(LEVEL_LABELS).toEqual({
      beginner: 'Beginner',
      intermediate: 'Intermediate',
      expert: 'Expert',
    });
    expect(FORCE_LABELS).toEqual({ pull: 'Pull', push: 'Push', static: 'Static' });
    expect(MECHANIC_LABELS).toEqual({ compound: 'Compound', isolation: 'Isolation' });
  });

  it('lists tracked metrics in the given (canonical) order', () => {
    expect(trackedMetricsText(['weight', 'reps'])).toBe('Weight, Reps');
  });
});
