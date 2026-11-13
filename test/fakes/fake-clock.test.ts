import { durationFromSeconds } from '@shared/domain/duration';
import { instantFromEpochMilliseconds } from '@shared/domain/instant';
import { describeClockContract } from '@test/contracts/clock.contract';

import { FakeClock } from './fake-clock';

const START_EPOCH_MILLISECONDS = 1_793_000_000_000;

describeClockContract('FakeClock', () => new FakeClock());

describe('FakeClock', () => {
  it('starts at a fixed default instant', () => {
    expect(new FakeClock().now()).toBe(new FakeClock().now());
  });

  it('starts at the given instant', () => {
    const start = instantFromEpochMilliseconds(START_EPOCH_MILLISECONDS);
    if (!start.ok) throw new Error('invalid test instant');

    expect(new FakeClock(start.value).now()).toBe(START_EPOCH_MILLISECONDS);
  });

  it('returns the start plus the durations it was advanced by', () => {
    const clock = new FakeClock();
    const start = clock.now();
    const ninetySeconds = durationFromSeconds(90);
    if (!ninetySeconds.ok) throw new Error('invalid test duration');

    clock.advanceBy(ninetySeconds.value);
    clock.advanceBy(ninetySeconds.value);

    expect(clock.now()).toBe(start + 180_000);
  });

  it('never reads real time', () => {
    const realNow = jest.spyOn(Date, 'now');

    new FakeClock().now();

    expect(realNow).not.toHaveBeenCalled();
    realNow.mockRestore();
  });
});
