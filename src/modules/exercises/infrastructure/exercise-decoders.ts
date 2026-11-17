import { describeCause } from '@shared/domain/describe-cause';
import { parseExerciseId, type ExerciseId } from '@shared/domain/ids';
import { err, map, mapErr, ok, type Result } from '@shared/domain/result';

import { comparisonKey } from '../domain/comparison-key';
import {
  parseDatasetImagePath,
  parsePhotoFileName,
  parseSeedSourceKey,
  type BuiltInImage,
  type CustomPhoto,
  type ExerciseForce,
  type ExerciseLevel,
  type ExerciseMechanic,
  type SeedSourceKey,
} from '../domain/exercise';
import { TRACKED_METRICS, type TrackedMetric } from '../domain/tracked-metric';
import type { VocabularyKey, VocabularyKind, VocabularyOrigin } from '../domain/vocabulary';

/**
 * Decoders: validate untrusted stored data (SQLite rows, the bundled seed asset) into domain
 * values, never casting (Data Mapper support, ADR-004 §2). A failure carries a readable reason;
 * the adapter turns it into `exercises.storageFailed` or `exercises.seedAssetInvalid`.
 */
export type Decoded<T> = Result<T, string>;
export type Decoder<T> = (raw: unknown) => Decoded<T>;

const LEVELS: Readonly<Record<ExerciseLevel, true>> = {
  beginner: true,
  intermediate: true,
  expert: true,
};
const FORCES: Readonly<Record<ExerciseForce, true>> = { pull: true, push: true, static: true };
const MECHANICS: Readonly<Record<ExerciseMechanic, true>> = { compound: true, isolation: true };
const VOCABULARY_KINDS: Readonly<Record<VocabularyKind, true>> = {
  category: true,
  muscle: true,
  equipment: true,
};
const VOCABULARY_ORIGINS: Readonly<Record<VocabularyOrigin, true>> = {
  builtIn: true,
  custom: true,
};

const describe = (raw: unknown): string => JSON.stringify(raw) ?? String(raw);

export function isRecord(raw: unknown): raw is Readonly<Record<string, unknown>> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw);
}

export function decodeJson(text: string): Decoded<unknown> {
  try {
    const parsed: unknown = JSON.parse(text);
    return ok(parsed);
  } catch (cause) {
    return err(`not valid JSON (${describeCause(cause)})`);
  }
}

/** A list whose every item passes `decoder`; the failure names the position. */
export function listOf<T>(decoder: Decoder<T>): Decoder<readonly T[]> {
  return (raw) => {
    if (!Array.isArray(raw)) return err(`expected a list, got ${describe(raw)}`);
    const items: T[] = [];
    for (const [index, item] of raw.entries()) {
      const decoded = decoder(item);
      if (!decoded.ok) return err(`[${index}] ${decoded.error}`);
      items.push(decoded.value);
    }
    return ok(Object.freeze(items));
  };
}

export function nullable<T>(decoder: Decoder<T>): Decoder<T | null> {
  return (raw) => (raw === null ? ok(null) : decoder(raw));
}

export const decodeText: Decoder<string> = (raw) =>
  typeof raw === 'string' && raw.trim().length > 0
    ? ok(raw)
    : err(`expected non-blank text, got ${describe(raw)}`);

export const decodeTextList = listOf(decodeText);

/** A vocabulary key must already be a comparison key (its own fixed point). */
export const decodeVocabularyKey: Decoder<VocabularyKey> = (raw) => {
  if (typeof raw !== 'string' || raw.length === 0) {
    return err(`expected a vocabulary key, got ${describe(raw)}`);
  }
  const key = comparisonKey(raw);
  return key === raw ? ok(key) : err(`"${raw}" is not a vocabulary key`);
};

export const decodeVocabularyKeys = listOf(decodeVocabularyKey);

function oneOf<T extends string>(allowed: Readonly<Record<T, true>>, what: string): Decoder<T> {
  const isAllowed = (raw: unknown): raw is T =>
    typeof raw === 'string' && Object.hasOwn(allowed, raw);
  return (raw) => (isAllowed(raw) ? ok(raw) : err(`unknown ${what} ${describe(raw)}`));
}

export const decodeLevel = oneOf(LEVELS, 'level');
export const decodeForce = oneOf(FORCES, 'force');
export const decodeMechanic = oneOf(MECHANICS, 'mechanic');
export const decodeVocabularyKind = oneOf(VOCABULARY_KINDS, 'vocabulary kind');
export const decodeVocabularyOrigin = oneOf(VOCABULARY_ORIGINS, 'vocabulary origin');

const decodeTrackedMetric: Decoder<TrackedMetric> = (raw) => {
  const metric = TRACKED_METRICS.find((candidate) => candidate === raw);
  return metric === undefined ? err(`unknown tracked metric ${describe(raw)}`) : ok(metric);
};

export const decodeTrackedMetrics: Decoder<readonly TrackedMetric[]> = (raw) => {
  const decoded = listOf(decodeTrackedMetric)(raw);
  return decoded.ok && decoded.value.length === 0
    ? err('expected at least one tracked metric')
    : decoded;
};

export const decodeNonNegativeInteger: Decoder<number> = (raw) =>
  typeof raw === 'number' && Number.isInteger(raw) && raw >= 0
    ? ok(raw)
    : err(`expected a non-negative integer, got ${describe(raw)}`);

export const decodePositiveInteger: Decoder<number> = (raw) =>
  typeof raw === 'number' && Number.isInteger(raw) && raw > 0
    ? ok(raw)
    : err(`expected a positive integer, got ${describe(raw)}`);

/** Wraps a domain parse function (`Result<T, DomainError>`) of a string as a decoder. */
function fromStringParser<T>(
  parse: (raw: string) => Result<T, { readonly message: string }>,
): Decoder<T> {
  return (raw) =>
    typeof raw === 'string'
      ? mapErr(parse(raw), ({ message }) => `${message} (${describe(raw)})`)
      : err(`expected text, got ${describe(raw)}`);
}

export const decodeExerciseId: Decoder<ExerciseId> = fromStringParser(parseExerciseId);
export const decodeSeedSourceKey: Decoder<SeedSourceKey> = fromStringParser(parseSeedSourceKey);
const decodeDatasetImagePath = fromStringParser(parseDatasetImagePath);
const decodePhotoFileName = fromStringParser(parsePhotoFileName);

const decodeBuiltInImage: Decoder<BuiltInImage> = (raw) => {
  if (!isRecord(raw)) return err(`expected an image, got ${describe(raw)}`);
  const path = decodeDatasetImagePath(raw['path']);
  if (!path.ok) return path;
  return map(decodeNonNegativeInteger(raw['sizeBytes']), (sizeBytes) =>
    Object.freeze({ kind: 'builtIn' as const, path: path.value, sizeBytes }),
  );
};

/** Built-in images as stored in rows and in the seed asset: `[{ path, sizeBytes }]`. */
export const decodeBuiltInImages = listOf(decodeBuiltInImage);

/** Custom photos as stored in rows: `["<file name>.jpg"]`. */
export const decodePhotos: Decoder<readonly CustomPhoto[]> = listOf((raw) =>
  map(decodePhotoFileName(raw), (fileName) => Object.freeze({ kind: 'photo' as const, fileName })),
);
