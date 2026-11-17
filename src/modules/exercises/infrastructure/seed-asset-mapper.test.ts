import {
  aBuiltInExercise,
  aVocabularyValue,
  builtInVocabularyValues,
} from '@test/builders/exercise.builder';
import {
  aSeedAssetJson,
  aSeedManifestJson,
  seedExerciseJson,
} from '@test/support/exercise-db-seed-asset';
import { unwrap } from '@test/support/unwrap';

import { decodeSeedDataset, decodeSeedManifest } from './seed-asset-mapper';

const failedWith = (pattern: RegExp) => ({
  ok: false,
  error: expect.stringMatching(pattern) as unknown,
});

const manifest = unwrap(decodeSeedManifest(aSeedManifestJson({ seedVersion: 3 })));
const vocabulary = builtInVocabularyValues();
const squat = aBuiltInExercise().named('Barbell Squat').buildData();
const assetWith = (overrides: Readonly<Record<string, unknown>>) => ({
  ...aSeedAssetJson({ exercises: [squat], vocabulary }, 3),
  ...overrides,
});
const exerciseWith = (overrides: Readonly<Record<string, unknown>>) =>
  assetWith({ exercises: [{ ...seedExerciseJson(squat), ...overrides }] });

describe('decodeSeedManifest', () => {
  it('reads the manifest fields the app uses', () => {
    expect(manifest).toEqual({
      seedVersion: 3,
      source: {
        name: 'free-exercise-db',
        repositoryUrl: 'https://github.com/yuhonas/free-exercise-db',
        commit: 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5',
        licence: { name: 'The Unlicense (public domain)', url: 'https://unlicense.org/' },
      },
      imageBaseUrl: 'https://images.example/exercises/',
      counts: { exercises: 2, images: 4, imageBytes: 226_000 },
    });
  });

  it.each([
    ['another format version', { formatVersion: 2 }, /formatVersion/],
    ['a zero seed version', { seedVersion: 0 }, /seedVersion/],
    ['an image base URL without a trailing slash', { imageBaseUrl: 'https://x/y' }, /imageBaseUrl/],
    ['a plain-HTTP image base URL', { imageBaseUrl: 'http://x/y/' }, /imageBaseUrl/],
    [
      'a source without licence',
      { source: { name: 'x', repositoryUrl: 'y', commit: 'z' } },
      /licence/,
    ],
    ['a source that is not an object', { source: 'free-exercise-db' }, /source/],
    ['negative counts', { counts: { exercises: -1, images: 0, imageBytes: 0 } }, /exercises/],
    ['counts that are not an object', { counts: null }, /counts/],
  ])('rejects %s', (_case, overrides, field) => {
    expect(decodeSeedManifest(aSeedManifestJson(overrides))).toEqual(failedWith(field));
  });

  it('rejects something that is not an object', () => {
    expect(decodeSeedManifest([])).toEqual(failedWith(/manifest/));
  });
});

describe('decodeSeedDataset', () => {
  it('maps the asset to domain values with built-in vocabulary', () => {
    const plank = aBuiltInExercise()
      .named('Plank')
      .with({ equipment: null, force: null, mechanic: null, images: [], instructions: [] })
      .buildData();

    expect(
      decodeSeedDataset(aSeedAssetJson({ exercises: [squat, plank], vocabulary }, 3), manifest),
    ).toEqual({ ok: true, value: { seedVersion: 3, vocabulary, exercises: [squat, plank] } });
  });

  it.each([
    ['another format version', assetWith({ formatVersion: 2 }), /formatVersion/],
    ['a seed version other than the manifest', assetWith({ seedVersion: 4 }), /seedVersion/],
    ['exercises that are not a list', assetWith({ exercises: {} }), /exercises/],
    ['a vocabulary that is not an object', assetWith({ vocabulary: [] }), /vocabulary/],
    [
      'a missing vocabulary kind',
      assetWith({ vocabulary: { category: [], muscle: [] } }),
      /equipment/,
    ],
    [
      'a vocabulary key that is not the key of its label',
      assetWith({
        vocabulary: { category: [{ key: 'core', label: 'Strength' }], muscle: [], equipment: [] },
      }),
      /category/,
    ],
    [
      'a vocabulary entry that is not an object',
      assetWith({ vocabulary: { category: ['strength'], muscle: [], equipment: [] } }),
      /category/,
    ],
    ['an exercise that is not an object', assetWith({ exercises: ['Squat'] }), /exercises\[0\]/],
    ['an invalid source key', exerciseWith({ key: 'Barbell Squat' }), /: key: /],
    ['an unknown level', exerciseWith({ level: 'master' }), /level/],
    [
      'an unknown category',
      exerciseWith({ category: 'yoga' }),
      /category: unknown category "yoga"/,
    ],
    ['an unknown muscle', exerciseWith({ secondaryMuscles: ['neck'] }), /secondaryMuscles/],
    ['an unknown equipment', exerciseWith({ equipment: 'sandbag' }), /equipment/],
    [
      'no primary muscle',
      exerciseWith({ primaryMuscles: [] }),
      /primaryMuscles: expected at least one/,
    ],
    [
      'an invalid image path',
      exerciseWith({ images: [{ path: '/abs.jpg', sizeBytes: 1 }] }),
      /images/,
    ],
    ['a blank name', exerciseWith({ name: '' }), /name/],
  ])('rejects an asset with %s', (_case, asset, reason) => {
    expect(decodeSeedDataset(asset, manifest)).toEqual(failedWith(reason));
  });

  it('names the failing exercise by position and key', () => {
    expect(decodeSeedDataset(exerciseWith({ level: 'master' }), manifest)).toEqual(
      failedWith(/exercises\[0\] "Barbell_Squat": level/),
    );
  });

  it('rejects two exercises with the same source key', () => {
    const asset = assetWith({ exercises: [seedExerciseJson(squat), seedExerciseJson(squat)] });

    expect(decodeSeedDataset(asset, manifest)).toEqual(
      failedWith(/exercises\[1\] "Barbell_Squat": duplicate source key/),
    );
  });

  it('rejects something that is not an object', () => {
    expect(decodeSeedDataset('exercises', manifest)).toEqual(failedWith(/seed/));
  });

  it('keeps the vocabulary order of the asset within each kind', () => {
    const values = [
      aVocabularyValue().ofKind('category').labelled('Strength').build(),
      aVocabularyValue().ofKind('muscle').labelled('Quadriceps').build(),
      aVocabularyValue().ofKind('muscle').labelled('Glutes').build(),
      aVocabularyValue().ofKind('muscle').labelled('Hamstrings').build(),
      aVocabularyValue().labelled('Barbell').build(),
    ];

    const decoded = decodeSeedDataset(
      aSeedAssetJson({ exercises: [], vocabulary: values }, 3),
      manifest,
    );

    expect(decoded.ok && decoded.value.vocabulary).toEqual(values);
  });
});
