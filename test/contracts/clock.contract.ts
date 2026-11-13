import type { Clock } from '@shared/application/clock';

import { defineContract } from './contract-harness';

/** Contract every `Clock` implementation must honour (S0-14). */
export const describeClockContract = defineContract<Clock>('Clock', (clock) => {
  it('returns a finite instant', () => {
    expect(Number.isFinite(clock().now())).toBe(true);
  });

  it('never goes backwards between successive calls', () => {
    const first = clock().now();
    const second = clock().now();

    expect(second).toBeGreaterThanOrEqual(first);
  });
});
