// @ts-check
/**
 * The pinned upstream dataset and its expected vocabularies (S1-11, ADR-004).
 *
 * Updating the dataset is a deliberate change: bump `commit`, re-run the conversion
 * (`assets/exercise-db/README.md`), and if the converter reports an unknown vocabulary value,
 * decide whether to add it here (it becomes a built-in value) — the app's default-metric rules
 * (S1-10) may need a new row for a new category.
 */

/**
 * @typedef {object} DatasetPin
 * @property {string} name display name in the credits
 * @property {string} repositoryUrl
 * @property {string} commit full 40-character commit SHA; images are fetched from this commit
 * @property {{ name: string, url: string }} licence
 * @property {string} imageBaseUrl prefix of every image path, ending in a slash
 */

const REPOSITORY = 'yuhonas/free-exercise-db';
const COMMIT = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5';

/** @type {DatasetPin} */
const DATASET_PIN = Object.freeze({
  name: 'free-exercise-db',
  repositoryUrl: `https://github.com/${REPOSITORY}`,
  commit: COMMIT,
  licence: Object.freeze({ name: 'The Unlicense (public domain)', url: 'https://unlicense.org/' }),
  imageBaseUrl: `https://raw.githubusercontent.com/${REPOSITORY}/${COMMIT}/exercises/`,
});

/** User-extensible vocabularies (decision Q5): the built-in values of the pinned version. */
const BUILT_IN_VOCABULARY = Object.freeze({
  category: Object.freeze([
    'cardio',
    'olympic weightlifting',
    'plyometrics',
    'powerlifting',
    'stretching',
    'strength',
    'strongman',
  ]),
  muscle: Object.freeze([
    'abdominals',
    'abductors',
    'adductors',
    'biceps',
    'calves',
    'chest',
    'forearms',
    'glutes',
    'hamstrings',
    'lats',
    'lower back',
    'middle back',
    'neck',
    'quadriceps',
    'shoulders',
    'traps',
    'triceps',
  ]),
  equipment: Object.freeze([
    'bands',
    'barbell',
    'body only',
    'cable',
    'dumbbell',
    'e-z curl bar',
    'exercise ball',
    'foam roll',
    'kettlebells',
    'machine',
    'medicine ball',
    'other',
  ]),
});

/** Closed, built-in-only attributes (not user-extensible); `null` is allowed for force/mechanic. */
const BUILT_IN_ATTRIBUTES = Object.freeze({
  level: Object.freeze(['beginner', 'intermediate', 'expert']),
  force: Object.freeze(['pull', 'push', 'static']),
  mechanic: Object.freeze(['compound', 'isolation']),
});

module.exports = { BUILT_IN_ATTRIBUTES, BUILT_IN_VOCABULARY, DATASET_PIN };
