// @ts-check
/**
 * Assembles the two bundled files from a converted dataset (S1-11, ADR-004 "Seed asset"):
 * - `exercises.json`: the seed itself (format version, seed version, vocabulary, exercises);
 * - `manifest.json`: small metadata the app reads without loading the seed (seed version, content
 *   hash, pinned source and licence for the credits, image base URL, counts).
 *
 * The seed version only ever goes up: unchanged content keeps it, changed content increments it
 * (S1-11 AC "strictly greater"), so the app's versioned seeding (S1-12) updates built-ins exactly
 * when the data changed.
 */
const crypto = require('node:crypto');

/** Shape version of both files; the app's seed source adapter rejects other versions. */
const SEED_FORMAT_VERSION = 1;
const FIRST_SEED_VERSION = 1;

const MALFORMED_MANIFEST =
  'The existing assets/exercise-db/manifest.json is malformed: it needs a whole "seedVersion" ≥ 1 and a "contentHash". Fix or restore it from git; never delete it to start over.';

/**
 * @typedef {import('./convert').ConvertedDataset} ConvertedDataset
 * @typedef {import('./pin').DatasetPin} DatasetPin
 * @typedef {{ seedVersion: number, contentHash: string }} PreviousManifest
 */

/** SHA-256 of the seeded content (exercises and vocabulary; not the notes). */
function contentHash(/** @type {Pick<ConvertedDataset, 'exercises' | 'vocabulary'>} */ dataset) {
  const canonical = JSON.stringify({
    vocabulary: dataset.vocabulary,
    exercises: dataset.exercises,
  });
  return `sha256:${crypto.createHash('sha256').update(canonical).digest('hex')}`;
}

/** @param {unknown} manifest @returns {manifest is PreviousManifest} */
function isPreviousManifest(manifest) {
  if (typeof manifest !== 'object' || manifest === null) return false;
  const { seedVersion, contentHash: hash } = /** @type {Record<string, unknown>} */ (manifest);
  return (
    typeof seedVersion === 'number' &&
    Number.isInteger(seedVersion) &&
    seedVersion >= FIRST_SEED_VERSION &&
    typeof hash === 'string'
  );
}

/** @param {PreviousManifest | null} previous @param {string} hash */
function nextSeedVersion(previous, hash) {
  if (previous === null) return FIRST_SEED_VERSION;
  return previous.contentHash === hash ? previous.seedVersion : previous.seedVersion + 1;
}

/** @param {ConvertedDataset} dataset @param {DatasetPin} pin @param {number} seedVersion @param {string} hash */
function manifestOf(dataset, pin, seedVersion, hash) {
  const images = dataset.exercises.flatMap((exercise) => exercise.images);
  return {
    formatVersion: SEED_FORMAT_VERSION,
    seedVersion,
    contentHash: hash,
    source: {
      name: pin.name,
      repositoryUrl: pin.repositoryUrl,
      commit: pin.commit,
      licence: { name: pin.licence.name, url: pin.licence.url },
    },
    imageBaseUrl: pin.imageBaseUrl,
    counts: {
      exercises: dataset.exercises.length,
      images: images.length,
      imageBytes: images.reduce((total, image) => total + image.sizeBytes, 0),
    },
  };
}

/**
 * @param {{ converted: ConvertedDataset, previousManifest: unknown, pin: DatasetPin }} input
 *   `previousManifest` is the parsed current `manifest.json`, or `null` when there is none yet
 */
function buildSeedAsset({ converted, previousManifest, pin }) {
  if (previousManifest !== null && !isPreviousManifest(previousManifest)) {
    return /** @type {const} */ ({ ok: false, errors: [MALFORMED_MANIFEST] });
  }
  const hash = contentHash(converted);
  const seedVersion = nextSeedVersion(previousManifest, hash);
  return /** @type {const} */ ({
    ok: true,
    value: {
      seed: {
        formatVersion: SEED_FORMAT_VERSION,
        seedVersion,
        vocabulary: converted.vocabulary,
        exercises: converted.exercises,
      },
      manifest: manifestOf(converted, pin, seedVersion, hash),
    },
  });
}

module.exports = { SEED_FORMAT_VERSION, buildSeedAsset, contentHash };
