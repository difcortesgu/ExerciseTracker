import type { Instant } from '@shared/domain/instant';

import { createToken } from './di/token';

/**
 * Port: the source of the current time. Domain and application code read time only through this
 * port (never `Date.now()`), so timers and timestamps are deterministic in tests (`FakeClock`).
 */
export interface Clock {
  /** The current instant (UTC epoch milliseconds). Successive calls never go backwards. */
  now(): Instant;
}

export const ClockToken = createToken<Clock>('shared.Clock');
