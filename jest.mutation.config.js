// @ts-check
/**
 * Jest configuration used by Stryker (npm run test:mutation): only the `app` project, because
 * mutants live in src/**\/domain and the tooling tests are irrelevant to them (and slow).
 */
const baseConfig = require('./jest.config');

/** @type {import('jest').Config} */
module.exports = {
  ...baseConfig,
  projects: (baseConfig.projects ?? []).filter(
    (project) => typeof project === 'object' && project.displayName === 'app',
  ),
};
