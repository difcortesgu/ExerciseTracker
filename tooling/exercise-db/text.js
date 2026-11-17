// @ts-check
/**
 * Text rules of the dataset conversion (S1-11, ADR-004 "Name comparison").
 *
 * `comparisonKey` must agree with the app's domain comparison function (S1-08): both are pinned by
 * the same examples ("  Barbell   squat " = "barbell SQUAT", "Préss" = "press", "Squat" ≠ "Squats").
 * The converter uses it to reject built-in names that the app would consider duplicates.
 */

/**
 * Combining diacritical mark blocks (U+0300–036F, U+1AB0–1AFF, U+1DC0–1DFF, U+20D0–20FF,
 * U+FE20–FE2F). An explicit class instead of `\p{M}`, so the app's Hermes engine and Node agree.
 */
const COMBINING_MARKS = /[̀-ͯ᪰-᫿᷀-᷿⃐-⃿︠-︯]/g;
const WHITESPACE_RUN = /\s+/g;

/** Trims and collapses inner whitespace; keeps case and accents (the text shown to the user). */
function normaliseDisplayText(/** @type {string} */ raw) {
  return raw.replace(WHITESPACE_RUN, ' ').trim();
}

/** Case- and accent-insensitive key: display-normalised, NFD, combining marks removed, lower case. */
function comparisonKey(/** @type {string} */ raw) {
  return normaliseDisplayText(raw).normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}

/** Display label of a dataset vocabulary value (assumption A1): "body only" → "Body only". */
function sentenceCase(/** @type {string} */ value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

module.exports = { comparisonKey, normaliseDisplayText, sentenceCase };
