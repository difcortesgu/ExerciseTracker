// @ts-check
/**
 * Jest configuration (ADR-001 "Testing").
 *
 * Two projects share one coverage policy:
 * - `app`: everything under src/, app/ and test/ with the jest-expo preset (React Native env).
 *   jest-expo derives `moduleNameMapper` from tsconfig.json `paths`, so tsconfig stays the single
 *   source of truth for aliases (tsc, Jest, Metro and ESLint all read it).
 * - `tooling`: tests of the build tooling itself (lint/boundary rules, TS strictness, coverage
 *   policy) in a plain Node environment.
 */
const { createCoverageConfig } = require('./tooling/jest/coverage-config');

const FIXTURES = '/__fixtures__/';

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'app',
      preset: 'jest-expo',
      roots: ['<rootDir>/src', '<rootDir>/app', '<rootDir>/test'],
      testMatch: ['**/*.test.{ts,tsx}'],
      testPathIgnorePatterns: ['/node_modules/', FIXTURES],
      modulePathIgnorePatterns: [FIXTURES],
    },
    {
      displayName: 'tooling',
      testEnvironment: 'node',
      roots: ['<rootDir>/tooling'],
      testMatch: ['**/*.test.{ts,tsx}'],
      testPathIgnorePatterns: ['/node_modules/', FIXTURES],
      modulePathIgnorePatterns: [FIXTURES],
    },
  ],
  ...createCoverageConfig(__dirname),
  coverageReporters: ['text-summary', 'text', 'lcov', 'json-summary'],
};
