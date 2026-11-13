import type { Clock } from '@shared/application/clock';
import type { Duration } from '@shared/domain/duration';
import { addDuration, instantFromEpochMilliseconds, type Instant } from '@shared/domain/instant';

import { unwrap } from '../support/unwrap';

/** 2026-01-01T00:00:00.000Z: a fixed, recognisable default so tests never depend on real time. */
const DEFAULT_START_EPOCH_MILLISECONDS = 1_767_225_600_000;

/** Fake `Clock`: time stands still until a test advances it. Never reads real time. */
export class FakeClock implements Clock {
  private current: Instant;

  constructor(
    start: Instant = unwrap(instantFromEpochMilliseconds(DEFAULT_START_EPOCH_MILLISECONDS)),
  ) {
    this.current = start;
  }

  now(): Instant {
    return this.current;
  }

  /** Test helper: moves time forward by `duration`. */
  advanceBy(duration: Duration): void {
    this.current = addDuration(this.current, duration);
  }
}
