import * as fc from 'fast-check';

import { unwrap } from '@test/support/unwrap';

import { createWeight, KILOGRAMS_PER_POUND, weightEquals, weightIn, type Weight } from './weight';

const MAX_REALISTIC_KILOGRAMS = 1e4;

const kilograms = (value: number): Weight => unwrap(createWeight(value, 'kg'));

const INVALID_NUMBERS = [
  -1,
  -0.001,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
];

describe('Weight', () => {
  describe('creation', () => {
    it.each([
      [0, 'kg'],
      [2.5, 'kg'],
      [100, 'kg'],
      [45, 'lb'],
    ] as const)('accepts %p %s', (value, unit) => {
      expect(weightIn(unwrap(createWeight(value, unit)), unit)).toBe(value);
    });

    it.each(INVALID_NUMBERS)('rejects %p with shared.invalidWeight', (value) => {
      expect(createWeight(value, 'lb')).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: 'shared.invalidWeight',
          message: expect.stringMatching(/\S/),
          details: { value, unit: 'lb' },
        }),
      });
    });

    it('creates frozen instances', () => {
      expect(Object.isFrozen(kilograms(20))).toBe(true);
    });
  });

  describe('conversion', () => {
    it('converts kilograms to pounds with the exact international pound', () => {
      expect(weightIn(kilograms(KILOGRAMS_PER_POUND), 'lb')).toBe(1);
      expect(weightIn(unwrap(createWeight(1, 'lb')), 'kg')).toBe(0.45359237);
    });

    it('converts kg to lb and back to the original value within tolerance', () => {
      fc.assert(
        fc.property(fc.double({ min: 0, max: MAX_REALISTIC_KILOGRAMS, noNaN: true }), (value) => {
          const inPounds = weightIn(kilograms(value), 'lb');
          const roundTrip = weightIn(unwrap(createWeight(inPounds, 'lb')), 'kg');

          expect(weightEquals(kilograms(roundTrip), kilograms(value))).toBe(true);
        }),
      );
    });

    it('returns numbers and leaves the original weight unchanged', () => {
      const weight = kilograms(100);

      weightIn(weight, 'lb');

      expect(weightIn(weight, 'kg')).toBe(100);
    });
  });

  describe('weightEquals', () => {
    it('treats 100 kg and its pound equivalent as equal', () => {
      const pounds = unwrap(createWeight(100 / KILOGRAMS_PER_POUND, 'lb'));

      expect(weightEquals(kilograms(100), pounds)).toBe(true);
    });

    it('treats different weights as different', () => {
      expect(weightEquals(kilograms(100), unwrap(createWeight(100, 'lb')))).toBe(false);
    });
  });
});
