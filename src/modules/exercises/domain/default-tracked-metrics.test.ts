import * as fc from 'fast-check';

import { vocabularyKeyOf } from '@test/builders/exercise.builder';

import {
  DEFAULT_METRIC_RULES,
  defaultTrackedMetrics,
  FALLBACK_METRICS,
} from './default-tracked-metrics';

const metricsFor = (category: string, equipment: string | null) =>
  defaultTrackedMetrics(
    vocabularyKeyOf(category),
    equipment === null ? null : vocabularyKeyOf(equipment),
  );

const STRENGTH_TYPES = ['strength', 'powerlifting', 'olympic weightlifting', 'strongman'];

describe('defaultTrackedMetrics (decision Q3)', () => {
  it.each([
    ['cardio', 'machine', ['time', 'distance']],
    ['cardio', null, ['time', 'distance']],
    ['stretching', 'foam roll', ['time']],
    ['plyometrics', 'body only', ['reps']],
    ['plyometrics', 'medicine ball', ['reps']],
  ])('derives %s with %p equipment → %p', (category, equipment, expected) => {
    expect(metricsFor(category, equipment)).toEqual(expected);
  });

  it.each(STRENGTH_TYPES)('derives %s with "body only" → reps', (category) => {
    expect(metricsFor(category, 'body only')).toEqual(['reps']);
  });

  it.each(STRENGTH_TYPES)('derives %s with any other equipment → weight, reps', (category) => {
    expect(metricsFor(category, 'barbell')).toEqual(['weight', 'reps']);
    expect(metricsFor(category, 'kettlebells')).toEqual(['weight', 'reps']);
  });

  it('applies the "any other equipment" rule of its category when equipment is missing', () => {
    expect(metricsFor('strength', null)).toEqual(['weight', 'reps']);
    expect(metricsFor('stretching', null)).toEqual(['time']);
  });

  it('falls back to weight and reps for a category the table does not cover', () => {
    expect(metricsFor('my own category', 'sandbag')).toEqual(['weight', 'reps']);
  });

  it('is a named, frozen rule table with a weight + reps fallback', () => {
    expect(Object.isFrozen(DEFAULT_METRIC_RULES)).toBe(true);
    expect(DEFAULT_METRIC_RULES.map(({ name }) => name)).toEqual([
      'cardio',
      'stretching',
      'plyometrics',
      'strength type, body only',
    ]);
    expect(FALLBACK_METRICS).toEqual(['weight', 'reps']);
  });

  it('never returns an empty list and never RPE', () => {
    const categories = fc.constantFrom(
      'cardio',
      'olympic weightlifting',
      'plyometrics',
      'powerlifting',
      'stretching',
      'strength',
      'strongman',
      'something new',
    );
    const equipment = fc.option(
      fc.constantFrom('bands', 'barbell', 'body only', 'cable', 'dumbbell', 'other', 'sandbag'),
    );
    fc.assert(
      fc.property(categories, equipment, (category, gear) => {
        const metrics = metricsFor(category, gear);

        expect(metrics.length).toBeGreaterThan(0);
        expect(metrics).not.toContain('rpe');
      }),
    );
  });
});
