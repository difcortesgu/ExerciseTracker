/**
 * Numeric helpers shared by the unit value objects (Duration, Weight, Distance).
 * Values are stored at full precision; equality tolerates floating-point noise from conversions.
 */

/** Relative tolerance for value equality; far below anything a user can enter or see. */
export const RELATIVE_EQUALITY_TOLERANCE = 1e-9;

/** Below this magnitude the tolerance stays absolute, so values near zero are not all "equal". */
const TOLERANCE_SCALE_FLOOR = 1;

export function isNonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/** Equal within {@link RELATIVE_EQUALITY_TOLERANCE}; non-finite values are only equal to themselves. */
export function approximatelyEqual(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return a === b;
  }
  const scale = Math.max(TOLERANCE_SCALE_FLOOR, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= RELATIVE_EQUALITY_TOLERANCE * scale;
}

/**
 * The same number, with `-0` turned into `0` (S1-01): `-0 + 0` is `0` and `x + 0` is `x` for every
 * other number, so value objects never store or read back a negative zero.
 */
export function withoutNegativeZero(value: number): number {
  return value + 0;
}
