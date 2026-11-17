import { domainError, type DomainError } from '@shared/domain/domain-error';
import { err, ok, type Result } from '@shared/domain/result';

import {
  characterCount,
  comparisonKey,
  normaliseDisplayText,
  type ComparisonKey,
} from './comparison-key';
import type { VocabularyValueError } from './exercise-errors';

/**
 * Vocabularies of an exercise (S1-08, S1-29, ADR-004 "Vocabularies"): built-in values of the
 * pinned dataset plus values the user adds from the custom-exercise form (decision Q5).
 *
 * A value is a **value object identified by `(kind, key)`**, where `key` is the comparison key of
 * its label. Exercises store keys, never labels, so a value can never change meaning: when a later
 * seed brings a built-in value equal to a user-defined one (same key), both rows are kept in
 * storage and shown once (the built-in label and origin win; ADR-004, T9).
 *
 * Phase 2 (core-dev, S1-29), in this file:
 * - `VOCABULARY_VALUE_MAX_LENGTH = 40` (characters after `normaliseDisplayText`);
 * - `mergeVocabulary(values: readonly VocabularyValue[]): Vocabulary` — one entry per
 *   `(kind, key)`, `builtIn` before `custom`, each kind sorted by key then label (stable,
 *   case- and accent-insensitive alphabetical order);
 * - `resolveVocabularySelection(vocabulary, kind, selection)` → `Result<ResolvedVocabularyValue,
 *   VocabularyValueError | unknown-value error>`: `existing` with an unknown key →
 *   `exercises.unknownCategory|unknownMuscle|unknownEquipment`; `new` with a blank label →
 *   `exercises.vocabularyValueRequired`, too long → `exercises.vocabularyValueTooLong`; `new` whose
 *   key equals an existing value of that kind → that existing value (no new value); otherwise a
 *   new `custom` value to be persisted with the exercise.
 */

/** The three user-extensible vocabularies. Level, force and mechanic are built-in only. */
export type VocabularyKind = 'category' | 'muscle' | 'equipment';

/** Identity of a value within its kind: the comparison key of its label. */
export type VocabularyKey = ComparisonKey;

/** `builtIn`: from the seed, read-only. `custom`: added by the user (S1-29). */
export type VocabularyOrigin = 'builtIn' | 'custom';

export interface VocabularyValue {
  readonly kind: VocabularyKind;
  readonly key: VocabularyKey;
  /** Display label: sentence case for built-ins ("Body only"), as typed (normalised) for custom. */
  readonly label: string;
  readonly origin: VocabularyOrigin;
}

/** Every value per kind after merging (one entry per key), in display order. */
export type Vocabulary = Readonly<Record<VocabularyKind, readonly VocabularyValue[]>>;

/**
 * How a form field refers to a value: an existing value by key, or a new user-defined label
 * entered with "Add your own" (resolved, de-duplicated and validated by the domain on save).
 */
export type VocabularySelection =
  | { readonly source: 'existing'; readonly key: VocabularyKey }
  | { readonly source: 'new'; readonly label: string };

/** A selection after resolution: the value to reference, and whether it must be persisted. */
export interface ResolvedVocabularyValue {
  readonly value: VocabularyValue;
  /** `true` only for a new `custom` value that does not exist yet in that vocabulary. */
  readonly isNew: boolean;
}

/** Longest user-defined value, in characters after `normaliseDisplayText` (S1-29). */
export const VOCABULARY_VALUE_MAX_LENGTH = 40;

/** Built-in values win over user-defined ones with the same key (ADR-004, T9). */
const ORIGIN_PRIORITY: Readonly<Record<VocabularyOrigin, number>> = { builtIn: 0, custom: 1 };

/** Error of an `existing` selection whose key is not in the vocabulary, per kind (rule table). */
const UNKNOWN_VALUE_CODES = {
  category: 'exercises.unknownCategory',
  muscle: 'exercises.unknownMuscle',
  equipment: 'exercises.unknownEquipment',
} as const satisfies Record<VocabularyKind, string>;

export type UnknownVocabularyValueError = DomainError<(typeof UNKNOWN_VALUE_CODES)[VocabularyKind]>;

function byDisplayOrder(first: VocabularyValue, second: VocabularyValue): number {
  return (
    compareText(first.key, second.key) ||
    ORIGIN_PRIORITY[first.origin] - ORIGIN_PRIORITY[second.origin] ||
    compareText(first.label, second.label)
  );
}

/** Locale-independent code-unit order (stable on every device). */
function compareText(first: string, second: string): number {
  if (first === second) return 0;
  return first < second ? -1 : 1;
}

function mergeKind(values: readonly VocabularyValue[], kind: VocabularyKind) {
  const sorted = values.filter((value) => value.kind === kind).sort(byDisplayOrder);
  return Object.freeze(sorted.filter((value, index) => sorted[index - 1]?.key !== value.key));
}

/**
 * Every stored value merged for display: one entry per `(kind, key)` (the built-in label and
 * origin win), each kind sorted by key (case- and accent-insensitive alphabetical order).
 */
export function mergeVocabulary(values: readonly VocabularyValue[]): Vocabulary {
  return Object.freeze({
    category: mergeKind(values, 'category'),
    muscle: mergeKind(values, 'muscle'),
    equipment: mergeKind(values, 'equipment'),
  });
}

export type VocabularySelectionError = VocabularyValueError | UnknownVocabularyValueError;

/**
 * Validates and normalises the label of a new ("Add your own") value (S1-29): trimmed, inner
 * whitespace collapsed, 1..40 characters. Returns the normalised label.
 */
export function validateVocabularyLabel(label: string): Result<string, VocabularyValueError> {
  const normalised = normaliseDisplayText(label);
  if (normalised.length === 0) {
    return err(domainError('exercises.vocabularyValueRequired', 'Enter a value.'));
  }
  if (characterCount(normalised) > VOCABULARY_VALUE_MAX_LENGTH) {
    return err(
      domainError(
        'exercises.vocabularyValueTooLong',
        `Use at most ${VOCABULARY_VALUE_MAX_LENGTH} characters.`,
        { maximum: VOCABULARY_VALUE_MAX_LENGTH },
      ),
    );
  }
  return ok(normalised);
}

function findValue(vocabulary: Vocabulary, kind: VocabularyKind, key: VocabularyKey) {
  return vocabulary[kind].find((value) => value.key === key);
}

function resolveExisting(
  vocabulary: Vocabulary,
  kind: VocabularyKind,
  key: VocabularyKey,
): Result<ResolvedVocabularyValue, UnknownVocabularyValueError> {
  const value = findValue(vocabulary, kind, key);
  return value === undefined
    ? err(domainError(UNKNOWN_VALUE_CODES[kind], `Unknown ${kind} value.`, { key }))
    : ok(Object.freeze({ value, isNew: false }));
}

/**
 * Resolves a new ("Add your own") label (S1-29): validated and normalised; equal (comparison key)
 * to an existing value of that kind → that value; otherwise a new `custom` value.
 */
export function resolveNewVocabularyValue(
  vocabulary: Vocabulary,
  kind: VocabularyKind,
  label: string,
): Result<ResolvedVocabularyValue, VocabularyValueError> {
  const validated = validateVocabularyLabel(label);
  if (!validated.ok) return validated;
  const key = comparisonKey(validated.value);
  const existing = findValue(vocabulary, kind, key);
  return existing === undefined
    ? ok(
        Object.freeze({
          value: Object.freeze({ kind, key, label: validated.value, origin: 'custom' as const }),
          isNew: true,
        }),
      )
    : ok(Object.freeze({ value: existing, isNew: false }));
}

/**
 * Resolves what a form field selected to the value it references (S1-08, S1-29): an `existing`
 * key must be in that kind's vocabulary; a `new` label is validated and, when it equals (comparison
 * key) an existing value of that kind, that value is reused — otherwise it is a new `custom` value
 * to persist with the exercise.
 */
export function resolveVocabularySelection(
  vocabulary: Vocabulary,
  kind: VocabularyKind,
  selection: VocabularySelection,
): Result<ResolvedVocabularyValue, VocabularySelectionError> {
  return selection.source === 'existing'
    ? resolveExisting(vocabulary, kind, selection.key)
    : resolveNewVocabularyValue(vocabulary, kind, selection.label);
}
