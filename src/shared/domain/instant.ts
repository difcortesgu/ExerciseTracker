import type { Brand } from './brand';
import { domainError, type DomainError } from './domain-error';
import { toMilliseconds, type Duration } from './duration';
import { err, ok, type Result } from './result';

/** A point in time as UTC epoch milliseconds. Obtained from the `Clock` port, never `Date.now()`. */
export type Instant = Brand<number, 'Instant'>;

export type InvalidInstantError = DomainError<'shared.invalidInstant'>;

function isInstant(epochMilliseconds: number): epochMilliseconds is Instant {
  return Number.isFinite(epochMilliseconds);
}

export function instantFromEpochMilliseconds(
  epochMilliseconds: number,
): Result<Instant, InvalidInstantError> {
  return isInstant(epochMilliseconds)
    ? ok(epochMilliseconds)
    : err(
        domainError(
          'shared.invalidInstant',
          'An instant must be a finite number of milliseconds.',
          {
            value: epochMilliseconds,
          },
        ),
      );
}

/** Returns the instant `duration` later; overflowing is a programmer error. */
export function addDuration(instant: Instant, duration: Duration): Instant {
  const later = instant + toMilliseconds(duration);
  if (!isInstant(later)) {
    throw new Error(`Instant overflow: ${instant} + ${toMilliseconds(duration)} ms.`);
  }
  return later;
}
