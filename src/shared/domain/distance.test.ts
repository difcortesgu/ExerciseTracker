import * as fc from 'fast-check';

import { unwrap } from '@test/support/unwrap';

import {
  createDistance,
  distanceEquals,
  distanceIn,
  METRES_PER_MILE,
  type Distance,
  type DistanceUnit,
} from './distance';
import { isOk } from './result';

const MAX_REALISTIC_METRES = 1e7;
const UNITS: readonly DistanceUnit[] = ['m', 'km', 'mi'];

const distance = (value: number, unit: DistanceUnit): Distance =>
  unwrap(createDistance(value, unit));

const INVALID_NUMBERS = [
  -1,
  -0.001,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
];

describe('Distance', () => {
  describe('creation', () => {
    it.each([
      [0, 'm'],
      [400, 'm'],
      [5, 'km'],
      [26.2, 'mi'],
    ] as const)('accepts %p %s', (value, unit) => {
      expect(distanceIn(distance(value, unit), unit)).toBeCloseTo(value, 9);
    });

    it.each(INVALID_NUMBERS)('rejects %p with shared.invalidDistance', (value) => {
      expect(createDistance(value, 'km')).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: 'shared.invalidDistance',
          message: expect.stringMatching(/\S/),
          details: { value, unit: 'km' },
        }),
      });
    });

    it('rejects values that overflow when converted to metres', () => {
      expect(isOk(createDistance(Number.MAX_VALUE, 'km'))).toBe(false);
    });

    it('creates frozen instances', () => {
      expect(Object.isFrozen(distance(1, 'km'))).toBe(true);
    });
  });

  describe('conversion', () => {
    it('converts between metres, kilometres and miles', () => {
      expect(distanceIn(distance(1, 'km'), 'm')).toBe(1000);
      expect(distanceIn(distance(1, 'mi'), 'm')).toBe(METRES_PER_MILE);
      expect(distanceIn(distance(1609.344, 'm'), 'mi')).toBe(1);
    });

    it('keeps full precision (rounding is only for display)', () => {
      expect(distanceIn(distance(1234.5678, 'm'), 'km')).toBeCloseTo(1.2345678, 12);
    });

    it('converts to any unit and back to the original within tolerance', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: MAX_REALISTIC_METRES, noNaN: true }),
          fc.constantFrom(...UNITS),
          fc.constantFrom(...UNITS),
          (value, from, to) => {
            const original = distance(value, from);
            const converted = distance(distanceIn(original, to), to);

            expect(distanceEquals(converted, original)).toBe(true);
          },
        ),
      );
    });
  });

  describe('distanceEquals', () => {
    it('treats 1 km and 1000 m as equal', () => {
      expect(distanceEquals(distance(1, 'km'), distance(1000, 'm'))).toBe(true);
    });

    it('treats different distances as different', () => {
      expect(distanceEquals(distance(1, 'km'), distance(1, 'mi'))).toBe(false);
    });
  });
});
