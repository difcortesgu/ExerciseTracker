import { andThen, err, map, mapErr, ok } from '@shared/domain/result';

import type { SeedDataset, SeedManifest } from '../application/library-seed-ports';
import { comparisonKey } from '../domain/comparison-key';
import type { BuiltInExerciseData } from '../domain/exercise';
import type { VocabularyKey, VocabularyKind, VocabularyValue } from '../domain/vocabulary';

import { decodeFields } from './decoded-fields';
import {
  decodeBuiltInImages,
  decodeForce,
  decodeLevel,
  decodeMechanic,
  decodeNonNegativeInteger,
  decodePositiveInteger,
  decodeSeedSourceKey,
  decodeText,
  decodeTextList,
  decodeVocabularyKey,
  isRecord,
  listOf,
  nullable,
  type Decoded,
  type Decoder,
} from './exercise-decoders';

/**
 * Data Mapper from the bundled seed files (`assets/exercise-db/manifest.json`, `exercises.json`,
 * written by tooling/exercise-db, ADR-004 §1) to the seed port's domain values. Every record goes
 * through the domain parse functions; any problem is described (the adapter reports
 * `exercises.seedAssetInvalid`, or fails construction for a broken manifest).
 */

/** The only seed file format this app version reads. */
export const SEED_FORMAT_VERSION = 1;

const KINDS = ['category', 'muscle', 'equipment'] as const satisfies readonly VocabularyKind[];

type KnownKeys = Readonly<Record<VocabularyKind, ReadonlySet<VocabularyKey>>>;

const describe = (raw: unknown): string => JSON.stringify(raw) ?? String(raw);

const decodeFormatVersion: Decoder<number> = (raw) =>
  raw === SEED_FORMAT_VERSION
    ? ok(SEED_FORMAT_VERSION)
    : err(`expected format version ${SEED_FORMAT_VERSION}, got ${describe(raw)}`);

/** Image URLs are built as `imageBaseUrl + path`, so it must be HTTPS and end with `/`. */
const decodeImageBaseUrl: Decoder<string> = (raw) =>
  typeof raw === 'string' && raw.startsWith('https://') && raw.endsWith('/')
    ? ok(raw)
    : err(`expected an https URL ending with "/", got ${describe(raw)}`);

function objectOf<T>(
  decode: (record: Readonly<Record<string, unknown>>) => Decoded<T>,
): Decoder<T> {
  return (raw) => (isRecord(raw) ? decode(raw) : err(`expected an object, got ${describe(raw)}`));
}

const decodeLicence = objectOf((raw) =>
  map(decodeFields({ name: decodeText(raw['name']), url: decodeText(raw['url']) }), (fields) =>
    Object.freeze({ name: fields.name.value, url: fields.url.value }),
  ),
);

const decodeSource = objectOf((raw) =>
  map(
    decodeFields({
      name: decodeText(raw['name']),
      repositoryUrl: decodeText(raw['repositoryUrl']),
      commit: decodeText(raw['commit']),
      licence: decodeLicence(raw['licence']),
    }),
    (fields) =>
      Object.freeze({
        name: fields.name.value,
        repositoryUrl: fields.repositoryUrl.value,
        commit: fields.commit.value,
        licence: fields.licence.value,
      }),
  ),
);

const decodeCounts = objectOf((raw) =>
  map(
    decodeFields({
      exercises: decodeNonNegativeInteger(raw['exercises']),
      images: decodeNonNegativeInteger(raw['images']),
      imageBytes: decodeNonNegativeInteger(raw['imageBytes']),
    }),
    (fields) =>
      Object.freeze({
        exercises: fields.exercises.value,
        images: fields.images.value,
        imageBytes: fields.imageBytes.value,
      }),
  ),
);

export function decodeSeedManifest(raw: unknown): Decoded<SeedManifest> {
  if (!isRecord(raw)) return err(`manifest: expected an object, got ${describe(raw)}`);
  const decoded = decodeFields({
    formatVersion: decodeFormatVersion(raw['formatVersion']),
    seedVersion: decodePositiveInteger(raw['seedVersion']),
    source: decodeSource(raw['source']),
    imageBaseUrl: decodeImageBaseUrl(raw['imageBaseUrl']),
    counts: decodeCounts(raw['counts']),
  });
  return map(decoded, (fields) =>
    Object.freeze({
      seedVersion: fields.seedVersion.value,
      source: fields.source.value,
      imageBaseUrl: fields.imageBaseUrl.value,
      counts: fields.counts.value,
    }),
  );
}

/** A built-in value: its key must be the comparison key of its label (value identity, T7). */
const vocabularyEntryOf = (kind: VocabularyKind): Decoder<VocabularyValue> =>
  objectOf((raw) =>
    andThen(
      decodeFields({ key: decodeVocabularyKey(raw['key']), label: decodeText(raw['label']) }),
      ({ key, label }): Decoded<VocabularyValue> =>
        comparisonKey(label.value) === key.value
          ? ok(
              Object.freeze({
                kind,
                key: key.value,
                label: label.value,
                origin: 'builtIn' as const,
              }),
            )
          : err(`key "${key.value}" is not the key of label "${label.value}"`),
    ),
  );

const decodeVocabulary = objectOf((raw) =>
  map(
    decodeFields({
      category: listOf(vocabularyEntryOf('category'))(raw['category']),
      muscle: listOf(vocabularyEntryOf('muscle'))(raw['muscle']),
      equipment: listOf(vocabularyEntryOf('equipment'))(raw['equipment']),
    }),
    (fields): readonly VocabularyValue[] =>
      Object.freeze(KINDS.flatMap((kind) => fields[kind].value)),
  ),
);

function knownKeysOf(vocabulary: readonly VocabularyValue[]): KnownKeys {
  const keysOf = (kind: VocabularyKind) =>
    new Set(vocabulary.filter((value) => value.kind === kind).map(({ key }) => key));
  return { category: keysOf('category'), muscle: keysOf('muscle'), equipment: keysOf('equipment') };
}

const memberOf =
  (known: KnownKeys, kind: VocabularyKind): Decoder<VocabularyKey> =>
  (raw) =>
    andThen(decodeVocabularyKey(raw), (key) =>
      known[kind].has(key) ? ok(key) : err(`unknown ${kind} "${key}"`),
    );

const atLeastOne =
  <T>(decoder: Decoder<readonly T[]>, what: string): Decoder<readonly T[]> =>
  (raw) =>
    andThen(decoder(raw), (list) =>
      list.length > 0 ? ok(list) : err(`expected at least one ${what}`),
    );

const exerciseOf = (known: KnownKeys): Decoder<BuiltInExerciseData> =>
  objectOf((raw) =>
    map(
      decodeFields({
        key: decodeSeedSourceKey(raw['key']),
        name: decodeText(raw['name']),
        category: memberOf(known, 'category')(raw['category']),
        primaryMuscles: atLeastOne(
          listOf(memberOf(known, 'muscle')),
          'primary muscle',
        )(raw['primaryMuscles']),
        secondaryMuscles: listOf(memberOf(known, 'muscle'))(raw['secondaryMuscles']),
        equipment: nullable(memberOf(known, 'equipment'))(raw['equipment']),
        level: decodeLevel(raw['level']),
        force: nullable(decodeForce)(raw['force']),
        mechanic: nullable(decodeMechanic)(raw['mechanic']),
        instructions: decodeTextList(raw['instructions']),
        images: decodeBuiltInImages(raw['images']),
      }),
      (fields) =>
        Object.freeze({
          sourceKey: fields.key.value,
          name: fields.name.value,
          category: fields.category.value,
          primaryMuscles: fields.primaryMuscles.value,
          secondaryMuscles: fields.secondaryMuscles.value,
          equipment: fields.equipment.value,
          level: fields.level.value,
          force: fields.force.value,
          mechanic: fields.mechanic.value,
          instructions: fields.instructions.value,
          images: fields.images.value,
        }),
    ),
  );

const keyLabelOf = (raw: unknown): string =>
  isRecord(raw) && typeof raw['key'] === 'string' ? ` "${raw['key']}"` : '';

function decodeExercises(raw: unknown, known: KnownKeys): Decoded<readonly BuiltInExerciseData[]> {
  if (!Array.isArray(raw)) return err(`exercises: expected a list, got ${describe(raw)}`);
  const decodeExercise = exerciseOf(known);
  const exercises: BuiltInExerciseData[] = [];
  const sourceKeys = new Set<string>();
  for (const [index, item] of raw.entries()) {
    const position = `exercises[${index}]${keyLabelOf(item)}`;
    const decoded = mapErr(decodeExercise(item), (reason) => `${position}: ${reason}`);
    if (!decoded.ok) return decoded;
    if (sourceKeys.has(decoded.value.sourceKey)) return err(`${position}: duplicate source key`);
    sourceKeys.add(decoded.value.sourceKey);
    exercises.push(decoded.value);
  }
  return ok(Object.freeze(exercises));
}

const seedVersionOf =
  (manifest: SeedManifest): Decoder<number> =>
  (raw) =>
    raw === manifest.seedVersion
      ? ok(manifest.seedVersion)
      : err(`expected the manifest's seed version ${manifest.seedVersion}, got ${describe(raw)}`);

export function decodeSeedDataset(raw: unknown, manifest: SeedManifest): Decoded<SeedDataset> {
  if (!isRecord(raw)) return err(`seed: expected an object, got ${describe(raw)}`);
  const header = decodeFields({
    formatVersion: decodeFormatVersion(raw['formatVersion']),
    seedVersion: seedVersionOf(manifest)(raw['seedVersion']),
    vocabulary: decodeVocabulary(raw['vocabulary']),
  });
  return andThen(header, ({ seedVersion, vocabulary }) =>
    map(decodeExercises(raw['exercises'], knownKeysOf(vocabulary.value)), (exercises) =>
      Object.freeze({ seedVersion: seedVersion.value, vocabulary: vocabulary.value, exercises }),
    ),
  );
}
