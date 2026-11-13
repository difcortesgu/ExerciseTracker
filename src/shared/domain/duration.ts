import type { Brand } from './brand';
import { domainError, type DomainError } from './domain-error';
import { approximatelyEqual, isNonNegativeFinite } from './numbers';
import { err, ok, type Result } from './result';

/**
 * Duration value object (S0-12): immutable, canonical milliseconds at full precision, created only
 * through the factories below so seconds and milliseconds can never be mixed up.
 */
export type Duration = Brand<{ readonly milliseconds: number }, 'Duration'>;

export type InvalidDurationError = DomainError<'shared.invalidDuration'>;

const MILLISECONDS_PER_SECOND = 1000;

function isDuration(candidate: { readonly milliseconds: number }): candidate is Duration {
  return isNonNegativeFinite(candidate.milliseconds);
}

function fromCanonical(
  milliseconds: number,
  enteredValue: number,
): Result<Duration, InvalidDurationError> {
  const candidate = Object.freeze({ milliseconds });
  return isDuration(candidate)
    ? ok(candidate)
    : err(
        domainError('shared.invalidDuration', 'A duration must be a non-negative finite number.', {
          value: enteredValue,
        }),
      );
}

export function durationFromSeconds(seconds: number): Result<Duration, InvalidDurationError> {
  return fromCanonical(seconds * MILLISECONDS_PER_SECOND, seconds);
}

export function durationFromMilliseconds(
  milliseconds: number,
): Result<Duration, InvalidDurationError> {
  return fromCanonical(milliseconds, milliseconds);
}

function durationOrThrow(milliseconds: number): Duration {
  const result = durationFromMilliseconds(milliseconds);
  if (!result.ok) {
    throw new Error(`Duration overflow: ${milliseconds} ms is not a valid duration.`);
  }
  return result.value;
}

/** The identity element of {@link addDurations}. */
export const ZERO_DURATION: Duration = durationOrThrow(0);

/** Returns a new duration; overflowing past the largest finite number is a programmer error. */
export function addDurations(first: Duration, second: Duration): Duration {
  return durationOrThrow(first.milliseconds + second.milliseconds);
}

export function toMilliseconds(duration: Duration): number {
  return duration.milliseconds;
}

export function toSeconds(duration: Duration): number {
  return duration.milliseconds / MILLISECONDS_PER_SECOND;
}

/** Value equality, tolerant of floating-point noise from unit conversions. */
export function durationEquals(first: Duration, second: Duration): boolean {
  return approximatelyEqual(first.milliseconds, second.milliseconds);
}
