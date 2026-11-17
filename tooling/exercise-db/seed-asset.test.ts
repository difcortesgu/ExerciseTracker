import { convertDataset } from './convert';
import { DATASET_PIN } from './pin';
import { buildSeedAsset, contentHash, SEED_FORMAT_VERSION } from './seed-asset';
import { anUpstreamExercise, aTreeFor, type UpstreamExercise } from './upstream-fixtures';

const converted = (exercises: readonly UpstreamExercise[] = [anUpstreamExercise()]) => {
  const result = convertDataset({ upstream: exercises, tree: aTreeFor(exercises, sizes) });
  if (!result.ok) {
    throw new Error(result.errors.join('; '));
  }
  return result.value;
};

const sizes = { 'Barbell_Squat/0.jpg': 1_000, 'Barbell_Squat/1.jpg': 2_500 };

const build = (previousManifest: unknown, dataset = converted()) =>
  buildSeedAsset({ converted: dataset, previousManifest, pin: DATASET_PIN });

const versionOf = (result: ReturnType<typeof build>): number | undefined =>
  result.ok ? result.value.manifest.seedVersion : undefined;

describe('contentHash', () => {
  it('is stable for the same exercises and vocabulary', () => {
    expect(contentHash(converted())).toBe(contentHash(converted()));
    expect(contentHash(converted())).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('changes when any seeded content changes', () => {
    const renamed = converted([anUpstreamExercise({ name: 'Back Squat' })]);

    expect(contentHash(renamed)).not.toBe(contentHash(converted()));
  });
});

describe('buildSeedAsset: seed version', () => {
  it('starts at seed version 1 when there is no previous asset', () => {
    expect(versionOf(build(null))).toBe(1);
  });

  it('keeps the seed version when the content is unchanged (re-running is idempotent)', () => {
    const first = build(null);
    const previous = first.ok ? first.value.manifest : null;

    expect(versionOf(build(previous))).toBe(1);
  });

  it('increments the seed version when the content changed (S1-11: strictly greater)', () => {
    const previous = { seedVersion: 4, contentHash: 'sha256:old' };

    expect(versionOf(build(previous))).toBe(5);
  });

  it.each([
    ['a non-object', 'manifest'],
    ['a missing seed version', { contentHash: 'sha256:old' }],
    ['a seed version below 1', { seedVersion: 0, contentHash: 'sha256:old' }],
    ['a fractional seed version', { seedVersion: 1.5, contentHash: 'sha256:old' }],
    ['a missing content hash', { seedVersion: 2 }],
  ])('refuses a previous manifest with %s (the version could go backwards)', (_case, manifest) => {
    expect(build(manifest)).toEqual({
      ok: false,
      errors: [
        'The existing assets/exercise-db/manifest.json is malformed: it needs a whole "seedVersion" ≥ 1 and a "contentHash". Fix or restore it from git; never delete it to start over.',
      ],
    });
  });
});

describe('buildSeedAsset: files', () => {
  it('writes the seed with its format and seed version, vocabulary and exercises', () => {
    const dataset = converted();
    const result = build(null, dataset);

    expect(result.ok && result.value.seed).toEqual({
      formatVersion: SEED_FORMAT_VERSION,
      seedVersion: 1,
      vocabulary: dataset.vocabulary,
      exercises: dataset.exercises,
    });
  });

  it('records the pinned source, licence, image location and counts in the manifest', () => {
    const dataset = converted();
    const result = build(null, dataset);

    expect(result.ok && result.value.manifest).toEqual({
      formatVersion: SEED_FORMAT_VERSION,
      seedVersion: 1,
      contentHash: contentHash(dataset),
      source: {
        name: 'free-exercise-db',
        repositoryUrl: 'https://github.com/yuhonas/free-exercise-db',
        commit: DATASET_PIN.commit,
        licence: { name: 'The Unlicense (public domain)', url: 'https://unlicense.org/' },
      },
      imageBaseUrl: `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${DATASET_PIN.commit}/exercises/`,
      counts: { exercises: 1, images: 2, imageBytes: 3_500 },
    });
  });
});
