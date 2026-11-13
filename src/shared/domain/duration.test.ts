import * as fc from 'fast-check';

import { unwrap } from '@test/support/unwrap';

import {
  addDurations,
  durationEquals,
  durationFromMilliseconds,
  durationFromSeconds,
  toMilliseconds,
  toSeconds,
  ZERO_DURATION,
  type Duration,
} from './duration';
import { isOk } from './result';

const MAX_REALISTIC_SECONDS = 1e7;

const seconds = (value: number): Duration => unwrap(durationFromSeconds(value));

const anyDuration = fc
  .double({ min: 0, max: MAX_REALISTIC_SECONDS, noNaN: true })
  .map((value) => seconds(value));

const INVALID_NUMBERS = [
  -1,
  -0.001,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
];

describe('Duration', () => {
  describe('creation', () => {
    it.each([0, 0.5, 30, 3600])('accepts %p seconds', (value) => {
      expect(toSeconds(seconds(value))).toBe(value);
    });

    it.each(INVALID_NUMBERS)('rejects %p seconds with shared.invalidDuration', (value) => {
      expect(durationFromSeconds(value)).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: 'shared.invalidDuration',
          message: expect.stringMatching(/\S/),
          details: { value },
        }),
      });
    });

    it.each(INVALID_NUMBERS)('rejects %p milliseconds with shared.invalidDuration', (value) => {
      expect(durationFromMilliseconds(value)).toEqual({
        ok: false,
        error: expect.objectContaining({ code: 'shared.invalidDuration' }),
      });
    });

    it('rejects seconds that overflow when converted to milliseconds', () => {
      expect(isOk(durationFromSeconds(Number.MAX_VALUE))).toBe(false);
    });

    it('creates frozen instances', () => {
      expect(Object.isFrozen(seconds(1))).toBe(true);
      expect(Object.isFrozen(ZERO_DURATION)).toBe(true);
    });
  });

  describe('reading', () => {
    it('reads seconds and milliseconds consistently', () => {
      const duration = unwrap(durationFromMilliseconds(1500));

      expect(toMilliseconds(duration)).toBe(1500);
      expect(toSeconds(duration)).toBe(1.5);
    });

    it('keeps seconds and milliseconds consistent for any duration', () => {
      fc.assert(
        fc.property(anyDuration, (duration) => {
          expect(toMilliseconds(duration)).toBeCloseTo(toSeconds(duration) * 1000, 6);
        }),
      );
    });
  });

  describe('addDurations', () => {
    it('returns a new duration equal to the sum', () => {
      const first = seconds(30);
      const second = seconds(15);

      const sum = addDurations(first, second);

      expect(toSeconds(sum)).toBe(45);
      expect(toSeconds(first)).toBe(30);
      expect(toSeconds(second)).toBe(15);
    });

    it('has ZERO_DURATION as its identity element', () => {
      fc.assert(
        fc.property(anyDuration, (duration) => {
          expect(durationEquals(addDurations(duration, ZERO_DURATION), duration)).toBe(true);
          expect(durationEquals(addDurations(ZERO_DURATION, duration), duration)).toBe(true);
        }),
      );
    });

    it('is associative', () => {
      fc.assert(
        fc.property(anyDuration, anyDuration, anyDuration, (a, b, c) => {
          expect(
            durationEquals(
              addDurations(addDurations(a, b), c),
              addDurations(a, addDurations(b, c)),
            ),
          ).toBe(true);
        }),
      );
    });

    it('throws a programmer error when the sum overflows', () => {
      const huge = unwrap(durationFromMilliseconds(Number.MAX_VALUE));

      expect(() => addDurations(huge, huge)).toThrow(/overflow/);
    });
  });

  describe('durationEquals', () => {
    it('compares by value regardless of the unit used to create it', () => {
      expect(durationEquals(seconds(1.5), unwrap(durationFromMilliseconds(1500)))).toBe(true);
      expect(durationEquals(seconds(1.5), seconds(1.6))).toBe(false);
    });
  });
});
