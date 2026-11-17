// @ts-check
/**
 * Converts the pinned upstream free-exercise-db (`dist/exercises.json`) into the app's seed
 * exercises (S1-11, ADR-004). Pure: no I/O, so every rule is unit tested; `cli.js` does the I/O.
 *
 * Every record is validated against the pinned vocabularies (`pin.js`); all problems of all records
 * are reported together and the conversion fails, so a changed upstream never ships unnoticed.
 */
const { BUILT_IN_ATTRIBUTES, BUILT_IN_VOCABULARY } = require('./pin');
const { comparisonKey, normaliseDisplayText, sentenceCase } = require('./text');

/** Folder of the upstream repository that holds the images; image paths are relative to it. */
const IMAGE_ROOT = 'exercises/';
const PIN_HINT = 'Add it to tooling/exercise-db/pin.js if it is a new built-in value.';
const TREE_ERROR =
  'The git tree listing must be complete (GitHub "truncated": false) with a "tree" array.';

/**
 * @typedef {{ path: string, sizeBytes: number }} SeedImage
 * @typedef {object} SeedExercise
 * @property {string} key stable source key (the upstream id)
 * @property {string} name
 * @property {string} category
 * @property {string | null} equipment
 * @property {string} level
 * @property {string | null} force
 * @property {string | null} mechanic
 * @property {string[]} primaryMuscles
 * @property {string[]} secondaryMuscles
 * @property {string[]} instructions
 * @property {SeedImage[]} images
 * @typedef {{ key: string, label: string }} SeedVocabularyValue
 * @typedef {{ category: SeedVocabularyValue[], muscle: SeedVocabularyValue[], equipment: SeedVocabularyValue[] }} SeedVocabulary
 * @typedef {{ exercises: SeedExercise[], vocabulary: SeedVocabulary, notes: string[] }} ConvertedDataset
 * @typedef {{ ok: true, value: ConvertedDataset } | { ok: false, errors: string[] }} ConversionResult
 * @typedef {{ exercise?: SeedExercise, errors: string[], notes: string[] }} RecordOutcome
 */

/** @param {string[]} errors @returns {{ ok: false, errors: string[] }} */
const failure = (errors) => ({ ok: false, errors });

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** @param {unknown} value @returns {value is string[]} */
const isStringList = (value) =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

/** @param {unknown} value @returns {value is string} */
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

/** Image path (relative to `exercises/`) → size in bytes, from the GitHub git-tree listing. */
function readImageSizes(/** @type {unknown} */ tree) {
  if (!isRecord(tree) || tree.truncated !== false || !Array.isArray(tree.tree)) {
    return null;
  }
  /** @type {Map<string, number>} */
  const sizes = new Map();
  for (const entry of tree.tree) {
    if (isRecord(entry) && typeof entry.path === 'string' && typeof entry.size === 'number') {
      if (entry.path.startsWith(IMAGE_ROOT))
        sizes.set(entry.path.slice(IMAGE_ROOT.length), entry.size);
    }
  }
  return sizes;
}

/** @param {Record<string, unknown>} record @param {string} id @returns {string[]} */
function shapeErrors(record, id) {
  const lists = ['instructions', 'images', 'primaryMuscles', 'secondaryMuscles'];
  return [
    ...(isNonEmptyString(record.name) ? [] : [`${id}: "name" must be a non-empty string.`]),
    ...lists
      .filter((field) => !isStringList(record[field]))
      .map((field) => `${id}: "${field}" must be a list of strings.`),
  ];
}

/**
 * @param {string} id @param {string} field @param {unknown} value
 * @param {readonly string[]} allowed @param {boolean} nullable
 * @returns {string[]}
 */
function valueErrors(id, field, value, allowed, nullable) {
  if ((nullable && value === null) || (typeof value === 'string' && allowed.includes(value))) {
    return [];
  }
  return [
    `${id}: unknown ${field} "${String(value)}". Allowed: ${allowed.join(', ')}. ${PIN_HINT}`,
  ];
}

/** @param {string} id @param {Record<string, unknown>} record @param {string[]} muscles @returns {string[]} */
function vocabularyErrors(id, record, muscles) {
  return [
    ...valueErrors(id, 'category', record.category, BUILT_IN_VOCABULARY.category, false),
    ...muscles.flatMap((muscle) =>
      valueErrors(id, 'muscle', muscle, BUILT_IN_VOCABULARY.muscle, false),
    ),
    ...valueErrors(id, 'equipment', record.equipment ?? null, BUILT_IN_VOCABULARY.equipment, true),
    ...valueErrors(id, 'level', record.level, BUILT_IN_ATTRIBUTES.level, false),
    ...valueErrors(id, 'force', record.force ?? null, BUILT_IN_ATTRIBUTES.force, true),
    ...valueErrors(id, 'mechanic', record.mechanic ?? null, BUILT_IN_ATTRIBUTES.mechanic, true),
  ];
}

/**
 * @param {string} id @param {string[]} images @param {Map<string, number>} sizes
 * @returns {{ images: SeedImage[], errors: string[] }}
 */
function sizedImages(id, images, sizes) {
  const missing = images.filter((path) => !sizes.has(path));
  return {
    images: images.map((path) => ({ path, sizeBytes: sizes.get(path) ?? 0 })),
    errors: missing.map((path) => `${id}: image "${path}" is not in the pinned tree.`),
  };
}

/**
 * @param {Record<string, unknown>} record fields already validated
 * @param {string} id @param {Map<string, number>} sizes
 * @returns {RecordOutcome}
 */
function convertValidRecord(record, id, sizes) {
  const primaryMuscles = /** @type {string[]} */ (record.primaryMuscles);
  const listedSecondary = /** @type {string[]} */ (record.secondaryMuscles);
  const secondaryMuscles = listedSecondary.filter((muscle) => !primaryMuscles.includes(muscle));
  const overlap = listedSecondary.filter((muscle) => primaryMuscles.includes(muscle));
  const images = sizedImages(id, /** @type {string[]} */ (record.images), sizes);
  const errors = [
    ...(primaryMuscles.length === 0 ? [`${id}: needs at least one primary muscle.`] : []),
    ...vocabularyErrors(id, record, [...primaryMuscles, ...listedSecondary]),
    ...images.errors,
  ];
  const notes =
    overlap.length === 0
      ? []
      : [`${id}: removed secondary muscle(s) also listed as primary: ${overlap.join(', ')}`];
  if (errors.length > 0) return { errors, notes: [] };
  const exercise = {
    key: id,
    name: normaliseDisplayText(/** @type {string} */ (record.name)),
    category: /** @type {string} */ (record.category),
    equipment: /** @type {string | null} */ (record.equipment ?? null),
    level: /** @type {string} */ (record.level),
    force: /** @type {string | null} */ (record.force ?? null),
    mechanic: /** @type {string | null} */ (record.mechanic ?? null),
    primaryMuscles,
    secondaryMuscles,
    instructions: /** @type {string[]} */ (record.instructions)
      .map(normaliseDisplayText)
      .filter((step) => step.length > 0),
    images: images.images,
  };
  return { exercise, errors: [], notes };
}

/** @param {unknown} record @param {number} index @param {Map<string, number>} sizes @returns {RecordOutcome} */
function convertRecord(record, index, sizes) {
  if (!isRecord(record)) return { errors: [`#${index}: not an object.`], notes: [] };
  if (!isNonEmptyString(record.id)) {
    return { errors: [`#${index}: "id" must be a non-empty string.`], notes: [] };
  }
  const shape = shapeErrors(record, record.id);
  return shape.length > 0
    ? { errors: shape, notes: [] }
    : convertValidRecord(record, record.id, sizes);
}

/** Duplicate ids, and names the app would consider equal (S1-08 comparison, decision Q6). */
function duplicateErrors(/** @type {readonly SeedExercise[]} */ exercises) {
  /** @type {Set<string>} */
  const ids = new Set();
  /** @type {Map<string, string>} */
  const names = new Map();
  return exercises.flatMap((exercise) => {
    if (ids.has(exercise.key)) return [`${exercise.key}: duplicate id.`];
    ids.add(exercise.key);
    const owner = names.get(comparisonKey(exercise.name));
    if (owner !== undefined) {
      return [`${exercise.key}: name "${exercise.name}" duplicates the name of ${owner}.`];
    }
    names.set(comparisonKey(exercise.name), exercise.key);
    return [];
  });
}

/**
 * Locale-independent order (stable across machines). Only used on unique keys (duplicates fail the
 * conversion, vocabulary values are de-duplicated first), so "equal" never needs an answer.
 * @param {string} first @param {string} second
 */
const byCodeUnits = (first, second) => (first < second ? -1 : 1);

/** @param {Iterable<string>} values @returns {SeedVocabularyValue[]} */
const vocabularyValues = (values) =>
  [...new Set(values)].sort(byCodeUnits).map((key) => ({ key, label: sentenceCase(key) }));

/** The built-in vocabulary values in use, sorted by key, with display labels. */
function vocabularyOf(/** @type {readonly SeedExercise[]} */ exercises) {
  return {
    category: vocabularyValues(exercises.map((exercise) => exercise.category)),
    muscle: vocabularyValues(
      exercises.flatMap((exercise) => [...exercise.primaryMuscles, ...exercise.secondaryMuscles]),
    ),
    equipment: vocabularyValues(
      exercises.flatMap((exercise) => (exercise.equipment === null ? [] : [exercise.equipment])),
    ),
  };
}

/**
 * @param {{ upstream: unknown, tree: unknown }} input the upstream JSON and the git-tree listing
 * @returns {ConversionResult}
 */
function convertDataset({ upstream, tree }) {
  if (!Array.isArray(upstream)) {
    return failure(['The upstream dataset must be a JSON array of exercises.']);
  }
  const sizes = readImageSizes(tree);
  if (sizes === null) return failure([TREE_ERROR]);
  const outcomes = upstream.map((record, index) => convertRecord(record, index, sizes));
  const exercises = outcomes.flatMap((outcome) => (outcome.exercise ? [outcome.exercise] : []));
  const errors = [...outcomes.flatMap((outcome) => outcome.errors), ...duplicateErrors(exercises)];
  if (errors.length > 0) return failure(errors);
  const sorted = [...exercises].sort((first, second) => byCodeUnits(first.key, second.key));
  return {
    ok: true,
    value: {
      exercises: sorted,
      vocabulary: vocabularyOf(sorted),
      notes: outcomes.flatMap((outcome) => outcome.notes),
    },
  };
}

module.exports = { IMAGE_ROOT, convertDataset };
