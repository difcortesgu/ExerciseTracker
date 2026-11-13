// @ts-check
/** File groups the lint rules are scoped to, derived from the shared layer globs. */
const { LAYER_GLOBS } = require('../layers');

const DOMAIN_FILES = [LAYER_GLOBS.domain];
const APPLICATION_FILES = [LAYER_GLOBS.application];
/** Everything that renders UI: module presentation, the design system, the React DI binding and routes. */
const PRESENTATION_FILES = [
  LAYER_GLOBS.presentation,
  'src/core/presentation/**/*.{ts,tsx}',
  'app/**/*.{ts,tsx}',
];
/** Production code allowed to touch I/O: adapters plus the composition root and bootstrap sequence. */
const ADAPTER_AND_WIRING_FILES = [
  LAYER_GLOBS.infrastructure,
  'src/core/di/**/*.{ts,tsx}',
  'src/core/bootstrap/**/*.{ts,tsx}',
];
const TEST_FILES = ['**/*.test.{ts,tsx}', 'test/**/*.{ts,tsx}'];
/** Shared contract suites: modules that export the functions registering their cases (S0-20). */
const CONTRACT_SUITE_FILES = ['test/contracts/**/*.{ts,tsx}'];

module.exports = {
  DOMAIN_FILES,
  APPLICATION_FILES,
  PRESENTATION_FILES,
  ADAPTER_AND_WIRING_FILES,
  TEST_FILES,
  CONTRACT_SUITE_FILES,
};
