// @ts-check
/**
 * Coverage part of the Jest configuration, shared by jest.config.js and the coverage-enforcement
 * fixture so the enforcement test exercises the real settings (ADR-001 "Coverage").
 */
const fs = require('node:fs');
const path = require('node:path');

const micromatch = require('micromatch');

const { COVERAGE_POLICY, RELEASE_TOOLING_GLOB } = require('./coverage-policy');
const { selectApplicableThresholds } = require('./coverage-thresholds');

/**
 * Production code measured for coverage. Exclusions (each justified, listed in ADR-001):
 * - test files: they are the tests, not the code under test;
 * - type declaration files: no runtime code;
 * - module index.ts barrels: re-exports only, enforced by the `no-restricted-syntax` lint rule
 *   for src/modules/*\/index.ts, so they cannot hide logic;
 * - generated drizzle-kit migration files (SQL, journal and generated index), never hand-written;
 * - the release CLI process entry point (`tooling/release/release-cli.js`): two lines that hand
 *   `process` to the tested `run()`; it is exercised end to end by a spawned-process test, whose
 *   coverage Jest cannot collect.
 * The CI release scripts under tooling/release are measured (ADR-003): they decide what is published.
 * app/ routes are thin wiring outside src/ and are not measured; logic lives in presentation layers.
 * test/ (fakes, builders, contracts) is test support and is never production coverage.
 */
const COLLECT_COVERAGE_FROM = Object.freeze([
  'src/**/*.{ts,tsx}',
  '!src/**/*.test.{ts,tsx}',
  '!src/**/*.d.ts',
  '!src/modules/*/index.ts',
  '!src/shared/infrastructure/db/migrations/**',
  RELEASE_TOOLING_GLOB,
  '!tooling/release/release-cli.js',
]);

/** Folders that can contain measured files (narrows the file scan below). */
const MEASURED_ROOTS = Object.freeze(['src/**/*', 'tooling/release/**/*']);

/**
 * @param {string} rootDir project root
 * @returns {{ collectCoverageFrom: string[], coverageThreshold: import('./coverage-thresholds').ThresholdMap }}
 */
function createCoverageConfig(rootDir) {
  const collectCoverageFrom = [...COLLECT_COVERAGE_FROM];
  // Same patterns as collectCoverageFrom: a threshold activates exactly when Jest measures a file.
  const sourceFiles = micromatch(
    fs
      .globSync([...MEASURED_ROOTS], { cwd: rootDir })
      .map((file) => file.split(path.sep).join('/')),
    collectCoverageFrom,
  );
  return {
    collectCoverageFrom,
    coverageThreshold: selectApplicableThresholds(COVERAGE_POLICY, sourceFiles),
  };
}

module.exports = { createCoverageConfig };
