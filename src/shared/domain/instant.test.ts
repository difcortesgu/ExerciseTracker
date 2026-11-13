import { unwrap } from '@test/support/unwrap';

import { durationFromSeconds } from './duration';
import { addDuration, instantFromEpochMilliseconds, type Instant } from './instant';

const EPOCH_2026 = 1_793_000_000_000;

describe('Instant', () => {
  it('is created from finite epoch milliseconds', () => {
    const instant: Instant = unwrap(instantFromEpochMilliseconds(EPOCH_2026));

    expect(instant).toBe(EPOCH_2026);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects %p with shared.invalidInstant',
    (value) => {
      expect(instantFromEpochMilliseconds(value)).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: 'shared.invalidInstant',
          message: expect.stringMatching(/\S/),
          details: { value },
        }),
      });
    },
  );

  it('is not interchangeable with a plain number', () => {
    // @ts-expect-error -- a raw number is not an Instant
    const instant: Instant = EPOCH_2026;

    expect(instant).toBe(EPOCH_2026);
  });

  describe('addDuration', () => {
    it('moves the instant forward by the duration', () => {
      const start = unwrap(instantFromEpochMilliseconds(EPOCH_2026));

      expect(addDuration(start, unwrap(durationFromSeconds(1.5)))).toBe(EPOCH_2026 + 1500);
    });

    it('throws a programmer error when the result overflows', () => {
      const latest = unwrap(instantFromEpochMilliseconds(Number.MAX_VALUE));
      const forever = unwrap(durationFromSeconds(Number.MAX_VALUE / 1e4));

      expect(() => addDuration(latest, forever)).toThrow(/overflow/);
    });
  });
});
