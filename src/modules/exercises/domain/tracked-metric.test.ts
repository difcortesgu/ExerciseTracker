import * as fc from 'fast-check';

import { normaliseTrackedMetrics, TRACKED_METRICS, type TrackedMetric } from './tracked-metric';

describe('TRACKED_METRICS', () => {
  it('registers every metric once, in canonical order (PLAN §1)', () => {
    expect(TRACKED_METRICS).toEqual(['weight', 'reps', 'time', 'distance', 'rpe']);
  });

  it('is frozen, so the registry cannot change at runtime', () => {
    expect(Object.isFrozen(TRACKED_METRICS)).toBe(true);
  });
});

describe('normaliseTrackedMetrics', () => {
  it('orders metrics canonically whatever the input order', () => {
    expect(normaliseTrackedMetrics(['rpe', 'reps', 'weight'])).toEqual(['weight', 'reps', 'rpe']);
  });

  it('stores a metric picked twice only once', () => {
    expect(normaliseTrackedMetrics(['time', 'distance', 'time'])).toEqual(['time', 'distance']);
  });

  it('returns an empty list for no metrics (validation reports it)', () => {
    expect(normaliseTrackedMetrics([])).toEqual([]);
  });

  it('returns a frozen list', () => {
    expect(Object.isFrozen(normaliseTrackedMetrics(['reps']))).toBe(true);
  });

  it('is idempotent and keeps exactly the distinct metrics given', () => {
    const anyMetrics = fc.array(fc.constantFrom<TrackedMetric>(...TRACKED_METRICS));
    fc.assert(
      fc.property(anyMetrics, (metrics) => {
        const normalised = normaliseTrackedMetrics(metrics);

        expect(normaliseTrackedMetrics(normalised)).toEqual(normalised);
        expect(new Set(normalised)).toEqual(new Set(metrics));
        expect(normalised).toHaveLength(new Set(metrics).size);
      }),
    );
  });
});
