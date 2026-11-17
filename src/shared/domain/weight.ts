import type { Brand } from './brand';
import { domainError, type DomainError } from './domain-error';
import { approximatelyEqual, isNonNegativeFinite, withoutNegativeZero } from './numbers';
import { err, ok, type Result } from './result';

/**
 * Weight value object (S0-11): immutable, stored as canonical kilograms at full precision so the
 * history stays correct when the user switches units. Rounding happens only for display.
 */
export type Weight = Brand<{ readonly kilograms: number }, 'Weight'>;

export type WeightUnit = 'kg' | 'lb';

export type InvalidWeightError = DomainError<'shared.invalidWeight'>;

/** Exact international avoirdupois pound. */
export const KILOGRAMS_PER_POUND = 0.45359237;

/** Conversion table: adding a unit is one entry, no branching. */
const KILOGRAMS_PER_UNIT: Readonly<Record<WeightUnit, number>> = {
  kg: 1,
  lb: KILOGRAMS_PER_POUND,
};

function isWeight(candidate: { readonly kilograms: number }): candidate is Weight {
  return isNonNegativeFinite(candidate.kilograms);
}

export function createWeight(value: number, unit: WeightUnit): Result<Weight, InvalidWeightError> {
  const candidate = Object.freeze({
    kilograms: withoutNegativeZero(value * KILOGRAMS_PER_UNIT[unit]),
  });
  return isWeight(candidate)
    ? ok(candidate)
    : err(
        domainError('shared.invalidWeight', 'A weight must be a non-negative finite number.', {
          value,
          unit,
        }),
      );
}

/** The weight expressed in `unit`, at full precision. */
export function weightIn(weight: Weight, unit: WeightUnit): number {
  return weight.kilograms / KILOGRAMS_PER_UNIT[unit];
}

/** Value equality across units, tolerant of floating-point noise from conversions. */
export function weightEquals(first: Weight, second: Weight): boolean {
  return approximatelyEqual(first.kilograms, second.kilograms);
}
