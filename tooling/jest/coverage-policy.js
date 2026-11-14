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
});

module.exports = { COVERAGE_POLICY, LAYER_GLOBS, RELEASE_TOOLING_GLOB };
