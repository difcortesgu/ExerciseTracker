import type { SeedDataset } from '@modules/exercises/application/library-seed-ports';
import { describeExerciseSeedSourceContract } from '@test/contracts/exercises/exercise-seed-source.contract';
import { aBuiltInExercise, builtInVocabularyValues } from '@test/builders/exercise.builder';
import { aSeedAssetJson, aSeedManifestJson } from '@test/support/exercise-db-seed-asset';
import { unwrap } from '@test/support/unwrap';

import {
  AssetExerciseSeedSource,
  createBundledExerciseSeedSource,
} from './asset-exercise-seed-source';

const EMPTY: Omit<SeedDataset, 'seedVersion'> = { exercises: [], vocabulary: [] };

/** A source over an arranged asset; the loader resolves, or rejects with an arranged failure. */
function arrangedSource(manifest = aSeedManifestJson()) {
  let asset: unknown = aSeedAssetJson(EMPTY, 3);
  let failure: Error | null = null;
  const source = new AssetExerciseSeedSource({
    manifest,
    loadSeed: () => (failure === null ? Promise.resolve(asset) : Promise.reject(failure)),
  });
  return {
    source,
    givenAsset: (raw: unknown) => {
      asset = raw;
    },
    givenLoadFailure: (cause: Error) => {
      failure = cause;
    },
  };
}

describeExerciseSeedSourceContract('AssetExerciseSeedSource', () => {
  const arranged = arrangedSource();
  return {
    source: arranged.source,
    givenDataset: (content) =>
      arranged.givenAsset(aSeedAssetJson(content, arranged.source.manifest.seedVersion)),
    givenInvalidDataset: () =>
      arranged.givenAsset({ ...aSeedAssetJson(EMPTY, 3), exercises: [{ key: 'Squat' }] }),
    givenUnreadableDataset: () => arranged.givenLoadFailure(new Error('Cannot find module')),
  };
});

describe('AssetExerciseSeedSource', () => {
  it('fails construction for a manifest of the wrong shape (broken build artefact)', () => {
    expect(
      () => new AssetExerciseSeedSource({ manifest: { seedVersion: 1 }, loadSeed: jest.fn() }),
    ).toThrow(/manifest is invalid.*formatVersion/);
  });

  it('fails construction for a manifest of another format version', () => {
    expect(
      () =>
        new AssetExerciseSeedSource({
          manifest: aSeedManifestJson({ formatVersion: 2 }),
          loadSeed: jest.fn(),
        }),
    ).toThrow(/formatVersion/);
  });

  it('does not load the seed when constructed (only the manifest is read at startup)', () => {
    const loadSeed = jest.fn(() => Promise.resolve(aSeedAssetJson(EMPTY, 3)));

    new AssetExerciseSeedSource({ manifest: aSeedManifestJson(), loadSeed });

    expect(loadSeed).not.toHaveBeenCalled();
  });

  it('returns exercises.seedAssetInvalid with the reason for an invalid asset', async () => {
    const arranged = arrangedSource();
    arranged.givenAsset(aSeedAssetJson(EMPTY, 4));

    expect(await arranged.source.loadDataset()).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: 'exercises.seedAssetInvalid',
        details: { reason: expect.stringMatching(/seedVersion/) as unknown },
      }) as unknown,
    });
  });

  it('describes why the asset could not be loaded', async () => {
    const arranged = arrangedSource();
    arranged.givenLoadFailure(new Error('Cannot find module exercises.json'));

    expect(await arranged.source.loadDataset()).toMatchObject({
      ok: false,
      error: { details: { reason: 'Cannot find module exercises.json' } },
    });
  });

  it('resolves with exercises.seedAssetInvalid when the loader throws synchronously', async () => {
    const source = new AssetExerciseSeedSource({
      manifest: aSeedManifestJson(),
      loadSeed: () => {
        throw new Error('require failed');
      },
    });

    expect(await source.loadDataset()).toMatchObject({
      ok: false,
      error: { code: 'exercises.seedAssetInvalid', details: { reason: 'require failed' } },
    });
  });

  it('loads an arranged dataset through the domain values', async () => {
    const arranged = arrangedSource();
    const exercises = [aBuiltInExercise().buildData()];
    arranged.givenAsset(aSeedAssetJson({ exercises, vocabulary: builtInVocabularyValues() }, 3));

    expect(unwrap(await arranged.source.loadDataset()).exercises).toEqual(exercises);
  });
});

describe('createBundledExerciseSeedSource (the real assets/exercise-db files)', () => {
  it('reads the bundled manifest of the pinned dataset', () => {
    const { manifest } = createBundledExerciseSeedSource();

    expect(manifest.source.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(manifest.imageBaseUrl).toContain(manifest.source.commit);
  });

  it('loads and validates the whole bundled seed, matching the manifest counts', async () => {
    const source = createBundledExerciseSeedSource();

    const dataset = unwrap(await source.loadDataset());
    const images = dataset.exercises.flatMap((exercise) => exercise.images);

    expect(dataset.seedVersion).toBe(source.manifest.seedVersion);
    expect(dataset.exercises).toHaveLength(source.manifest.counts.exercises);
    expect(images).toHaveLength(source.manifest.counts.images);
    expect(images.reduce((total, { sizeBytes }) => total + sizeBytes, 0)).toBe(
      source.manifest.counts.imageBytes,
    );
  });
});
