import type { Brand } from './brand';
import { domainError, type DomainError } from './domain-error';
import { approximatelyEqual, isNonNegativeFinite } from './numbers';
import { err, ok, type Result } from './result';

/**
 * Distance value object (S0-13): immutable, stored as canonical metres at full precision so
 * metres, kilometres and miles can all be compared. Rounding happens only for display.
 */
export type Distance = Brand<{ readonly metres: number }, 'Distance'>;

export type DistanceUnit = 'm' | 'km' | 'mi';

export type InvalidDistanceError = DomainError<'shared.invalidDistance'>;

/** Exact international mile. */
export const METRES_PER_MILE = 1609.344;

const METRES_PER_KILOMETRE = 1000;

/** Conversion table: adding a unit is one entry, no branching. */
const METRES_PER_UNIT: Readonly<Record<DistanceUnit, number>> = {
  m: 1,
  km: METRES_PER_KILOMETRE,
  mi: METRES_PER_MILE,
};

function isDistance(candidate: { readonly metres: number }): candidate is Distance {
  return isNonNegativeFinite(candidate.metres);
}

export function createDistance(
  value: number,
  unit: DistanceUnit,
): Result<Distance, InvalidDistanceError> {
  const candidate = Object.freeze({ metres: value * METRES_PER_UNIT[unit] });
  return isDistance(candidate)
    ? ok(candidate)
    : err(
        domainError('shared.invalidDistance', 'A distance must be a non-negative finite number.', {
          value,
          unit,
        }),
      );
}

/** The distance expressed in `unit`, at full precision. */
export function distanceIn(distance: Distance, unit: DistanceUnit): number {
  return distance.metres / METRES_PER_UNIT[unit];
}

/** Value equality across units, tolerant of floating-point noise from conversions. */
export function distanceEquals(first: Distance, second: Distance): boolean {
  return approximatelyEqual(first.metres, second.metres);
}
