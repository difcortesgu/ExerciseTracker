import { describeClockContract } from '@test/contracts/clock.contract';

import { SystemClock } from './system-clock';

describeClockContract('SystemClock', () => new SystemClock());

describe('SystemClock', () => {
  it('reads the current wall-clock time in epoch milliseconds', () => {
    const before = Date.now();
    const now = new SystemClock().now();
    const after = Date.now();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(after);
  });
});

describe('SystemClock when the wall clock is set backwards', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps returning the latest instant instead of going back in time', () => {
    jest.spyOn(Date, 'now').mockReturnValueOnce(2_000).mockReturnValueOnce(1_000);
    const clock = new SystemClock();

    const first = clock.now();
    const second = clock.now();

    expect(first).toBe(2_000);
    expect(second).toBe(2_000);
  });

  it('throws a programmer error if the device returns an invalid time', () => {
    jest.spyOn(Date, 'now').mockReturnValue(Number.NaN);

    expect(() => new SystemClock().now()).toThrow(/invalid time/);
  });
});
