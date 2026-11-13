import * as fc from 'fast-check';

import { approximatelyEqual, isNonNegativeFinite, RELATIVE_EQUALITY_TOLERANCE } from './numbers';

describe('isNonNegativeFinite', () => {
  it.each([0, 0.5, 1, 1e300])('accepts %p', (value) => {
    expect(isNonNegativeFinite(value)).toBe(true);
  });

  it.each([-0.001, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects %p',
    (value) => {
      expect(isNonNegativeFinite(value)).toBe(false);
    },
  );
});

describe('approximatelyEqual', () => {
  it('treats values that differ only by floating-point noise as equal', () => {
    expect(approximatelyEqual(0.1 + 0.2, 0.3)).toBe(true);
    expect(approximatelyEqual(1e12 + 0.0001, 1e12)).toBe(true);
  });

  it('treats values that differ meaningfully as different', () => {
    expect(approximatelyEqual(100, 100.001)).toBe(false);
    expect(approximatelyEqual(0, 0.000001)).toBe(false);
  });

  it('includes the tolerance itself: a difference of exactly the tolerance is still equal', () => {
    expect(approximatelyEqual(0, RELATIVE_EQUALITY_TOLERANCE)).toBe(true);
    expect(approximatelyEqual(0, 2 * RELATIVE_EQUALITY_TOLERANCE)).toBe(false);
  });

  it('treats non-finite values as equal only to themselves', () => {
    expect(approximatelyEqual(5, Number.POSITIVE_INFINITY)).toBe(false);
    expect(approximatelyEqual(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)).toBe(true);
  });

  it('is reflexive and symmetric', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), fc.double(), (a, b) => {
        expect(approximatelyEqual(a, a)).toBe(true);
        expect(approximatelyEqual(a, b)).toBe(approximatelyEqual(b, a));
      }),
    );
  });
});
