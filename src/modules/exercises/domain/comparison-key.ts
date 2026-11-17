import type { Brand } from '@shared/domain/brand';

/**
 * The case-, accent- and spacing-insensitive form of a name or vocabulary value (S1-08 "same
 * name"): display-normalised (trimmed, inner whitespace collapsed), Unicode NFD, combining marks
 * removed, lower case. Two texts are "the same" iff their comparison keys are equal. It is also
 * the identity of a vocabulary value (`VocabularyKey`) and the search normalisation (S1-09).
 *
 * This file is the **only** implementation of the rule in the app (DRY). The converter in
 * `tooling/exercise-db/text.js` has a build-time copy pinned by the same examples (ADR-004).
 */
export type ComparisonKey = Brand<string, 'ComparisonKey'>;

/**
 * Combining diacritical mark blocks (U+0300–036F, U+1AB0–1AFF, U+1DC0–1DFF, U+20D0–20FF,
 * U+FE20–FE2F). An explicit class instead of `\p{M}`, so Hermes and Node agree (same class as
 * `tooling/exercise-db/text.js`).
 */
const COMBINING_MARKS = /[̀-ͯ᪰-᫿᷀-᷿⃐-⃿︠-︯]/g;
const WHITESPACE_RUN = /\s+/g;

/** Trims and collapses inner whitespace runs to one space; keeps case and accents (S1-08). */
export function normaliseDisplayText(raw: string): string {
  return raw.replace(WHITESPACE_RUN, ' ').trim();
}

/**
 * The comparison key of a text. Lower-casing comes first and whitespace is normalised last, so the
 * key is a fixed point (`comparisonKey(key) === key`, property-tested): lower-casing can itself
 * produce combining marks (e.g. "İ" → "i" + U+0307) and removing a mark can leave two spaces side
 * by side. On the dataset's text this gives the same result as the converter.
 */
export function comparisonKey(raw: string): ComparisonKey {
  const folded = normaliseDisplayText(
    raw.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, ''),
  );
  brandAsComparisonKey(folded);
  return folded;
}

/**
 * The only place a string becomes a `ComparisonKey`: the output of the folding above is a key by
 * definition (nothing is left to validate), so the brand is applied without a runtime check.
 */
function brandAsComparisonKey(_folded: string): asserts _folded is ComparisonKey {}

/** Length in characters (code points), as users count them: "💪" is one, not two UTF-16 units. */
export function characterCount(text: string): number {
  return Array.from(text).length;
}
