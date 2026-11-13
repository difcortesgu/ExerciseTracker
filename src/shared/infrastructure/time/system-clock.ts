import type { Clock } from '@shared/application/clock';
import { instantFromEpochMilliseconds, type Instant } from '@shared/domain/instant';

/**
 * Adapter: the device clock behind the `Clock` port; the only place that reads `Date.now()`.
 * The wall clock can be set backwards (manual change, network time sync), so the adapter never
 * returns an instant earlier than one it already returned, as the port requires.
 */
export class SystemClock implements Clock {
  private latest = Number.NEGATIVE_INFINITY;

  now(): Instant {
    this.latest = Math.max(this.latest, Date.now());
    const instant = instantFromEpochMilliseconds(this.latest);
    if (!instant.ok) {
      throw new Error(`The device clock returned an invalid time: ${this.latest}`);
    }
    return instant.value;
  }
}
