// Fixture project for coverage-enforcement.test.ts: uses the real coverage configuration.
const { createCoverageConfig } = require('../../coverage-config');

module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  ...createCoverageConfig(__dirname),
  coverageReporters: ['text-summary'],
};
