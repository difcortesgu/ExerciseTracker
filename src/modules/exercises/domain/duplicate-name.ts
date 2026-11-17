import {
  characterCount,
  comparisonKey,
  normaliseDisplayText,
  type ComparisonKey,
} from './comparison-key';
import { EXERCISE_LIMITS } from './exercise-draft';

const FIRST_NUMBER_SHOWN = 2;

/** " (custom)" for the first suggestion, then " (custom 2)", " (custom 3)" … */
function suffixFor(attempt: number): string {
  return attempt < FIRST_NUMBER_SHOWN ? ' (custom)' : ` (custom ${attempt})`;
}

/** The base shortened (by characters, no trailing space) so base + suffix fits the name limit. */
function withSuffix(base: string, attempt: number): string {
  const suffix = suffixFor(attempt);
  const room = EXERCISE_LIMITS.nameMaxLength - characterCount(suffix);
  return `${Array.from(base).slice(0, room).join('').trimEnd()}${suffix}`;
}

function firstFree(base: string, takenKeys: ReadonlySet<ComparisonKey>, attempt: number): string {
  const candidate = withSuffix(base, attempt);
  return takenKeys.has(comparisonKey(candidate))
    ? firstFree(base, takenKeys, attempt + 1)
    : candidate;
}

/**
 * The prefilled name of "Duplicate as custom" (S1-23, decision Q6): "<name> (custom)", or the first
 * free "(custom n)" from 2 upwards, compared by comparison key with the active exercises' names and
 * always within the 80-character limit (the base name is shortened if needed). Pure; the name is
 * checked again on save, since it may become taken in between.
 */
export function suggestDuplicateName(name: string, takenKeys: ReadonlySet<ComparisonKey>): string {
  return firstFree(normaliseDisplayText(name), takenKeys, 1);
}
