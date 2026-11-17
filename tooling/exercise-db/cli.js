// @ts-check
/**
 * Dataset conversion CLI (S1-11, ADR-004): reads the pinned upstream `exercises.json` and the
 * GitHub git-tree listing (image sizes), and writes `exercises.json` + `manifest.json` into the
 * output folder. How to fetch the inputs is documented in `assets/exercise-db/README.md`.
 *
 * All I/O goes through `CliIo`, so `run` is tested in-process; `exercise-db-cli.js` binds it to the
 * real process. Nothing is written unless the whole conversion succeeds.
 */
const { convertDataset } = require('./convert');
const { DATASET_PIN } = require('./pin');
const { buildSeedAsset } = require('./seed-asset');

/**
 * @typedef {object} CliIo
 * @property {(path: string) => string} readFile
 * @property {(path: string, content: string) => void} writeFile
 * @property {(path: string) => boolean} fileExists
 * @property {(line: string) => void} stdout
 * @property {(line: string) => void} stderr
 * @typedef {{ ok: true, value: unknown } | { ok: false, errors: string[] }} JsonOutcome
 */

const EXIT_OK = 0;
const EXIT_FAILURE = 1;
const MANIFEST_FILE = 'manifest.json';
const SEED_FILE = 'exercises.json';
const MANIFEST_INDENT = 2;
const USAGE =
  'Usage: node tooling/exercise-db/exercise-db-cli.js <upstream-exercises.json> <git-tree.json> <output-dir>';

/** @param {CliIo} io @param {string} path @returns {JsonOutcome} */
function readJson(io, path) {
  let text;
  try {
    text = io.readFile(path);
  } catch (cause) {
    return { ok: false, errors: [`Cannot read ${path}: ${String(cause)}`] };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (cause) {
    return { ok: false, errors: [`${path} is not valid JSON: ${String(cause)}`] };
  }
}

/** @param {CliIo} io @param {string} path @returns {JsonOutcome} */
const readOptionalJson = (io, path) =>
  io.fileExists(path) ? readJson(io, path) : { ok: true, value: null };

/** @param {CliIo} io @param {readonly string[]} errors */
function fail(io, errors) {
  errors.forEach((error) => io.stderr(error));
  return EXIT_FAILURE;
}

/**
 * @param {readonly string[]} args `[upstreamExercisesFile, gitTreeFile, outputDir]`
 * @param {CliIo} io
 * @returns {number} process exit code
 */
function run(args, io) {
  const [upstreamFile, treeFile, outputDir] = args;
  if (upstreamFile === undefined || treeFile === undefined || outputDir === undefined) {
    return fail(io, [USAGE]);
  }
  const upstream = readJson(io, upstreamFile);
  if (!upstream.ok) return fail(io, upstream.errors);
  const tree = readJson(io, treeFile);
  if (!tree.ok) return fail(io, tree.errors);
  const converted = convertDataset({ upstream: upstream.value, tree: tree.value });
  if (!converted.ok) return fail(io, converted.errors);
  const previousManifest = readOptionalJson(io, `${outputDir}/${MANIFEST_FILE}`);
  if (!previousManifest.ok) return fail(io, previousManifest.errors);
  const asset = buildSeedAsset({
    converted: converted.value,
    previousManifest: previousManifest.value,
    pin: DATASET_PIN,
  });
  if (!asset.ok) return fail(io, asset.errors);
  const { seed, manifest } = asset.value;
  io.writeFile(`${outputDir}/${SEED_FILE}`, `${JSON.stringify(seed)}\n`);
  io.writeFile(
    `${outputDir}/${MANIFEST_FILE}`,
    `${JSON.stringify(manifest, null, MANIFEST_INDENT)}\n`,
  );
  converted.value.notes.forEach((note) => io.stdout(`Note: ${note}`));
  const { exercises, images, imageBytes } = manifest.counts;
  io.stdout(
    `Seed version ${manifest.seedVersion}: ${exercises} exercises, ${images} images (${imageBytes} bytes).`,
  );
  return EXIT_OK;
}

module.exports = { run };
