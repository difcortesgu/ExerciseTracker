// @ts-check
/**
 * Per-layer coverage thresholds (docs/ENGINEERING_STANDARDS.md §4.2, ADR-001).
 * Values may only go up; coverage-policy.test.ts guards the agreed floors.
 *
 * Jest applies glob thresholds to every matching file individually, so e.g. each domain file
 * must reach 100% on its own (stricter than an aggregate, and the failure names the file).
 */

const { LAYER_GLOBS } = require('../layers');

/**
 * CI release scripts (Sprint 0.5, ADR-003): build number, release plan, signature and APK checks.
 * They decide whether a release is published, so they are held to the domain standard (100%).
 */
const RELEASE_TOOLING_GLOB = 'tooling/release/**/*.js';

/**
 * Exercise dataset conversion (Sprint 1, S1-11, ADR-004): validates the pinned free-exercise-db
 * and writes the seed every install receives, so it is held to the domain standard (100%).
 */
const EXERCISE_DB_TOOLING_GLOB = 'tooling/exercise-db/**/*.js';

/** @param {number} lines @param {number} branches @param {number} functions @param {number} statements */
const threshold = (lines, branches, functions, statements) => ({
  lines,
  branches,
  functions,
  statements,
});

/** @type {Record<string, { lines: number, branches: number, functions: number, statements: number }>} */
const COVERAGE_POLICY = Object.freeze({
  global: threshold(90, 85, 90, 90),
  [LAYER_GLOBS.domain]: threshold(100, 100, 100, 100),
  [LAYER_GLOBS.application]: threshold(100, 95, 100, 100),
  [LAYER_GLOBS.infrastructure]: threshold(90, 90, 90, 90),
  [LAYER_GLOBS.presentation]: threshold(85, 85, 85, 85),
  [LAYER_GLOBS.core]: threshold(90, 90, 90, 90),
  [RELEASE_TOOLING_GLOB]: threshold(100, 100, 100, 100),
  [EXERCISE_DB_TOOLING_GLOB]: threshold(100, 100, 100, 100),
});

module.exports = { COVERAGE_POLICY, EXERCISE_DB_TOOLING_GLOB, LAYER_GLOBS, RELEASE_TOOLING_GLOB };
