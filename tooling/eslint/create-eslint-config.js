/*
 * Not `@ts-check`ed: third-party plugin typings (eslint-plugin-boundaries) are not assignable to
 * ESLint's `Plugin` type under `exactOptionalPropertyTypes`. ESLint validates this config at
 * runtime and the rule tests in this folder exercise every rule.
 */
/**
 * ESLint flat-config factory (ADR-001 "Boundary enforcement").
 *
 * The same factory is used by eslint.config.js (rootDir = repository root) and by the rule tests
 * in this folder (rootDir = the fixture project), so the tests prove the real configuration.
 *
 * Layers and modules are classified by eslint-plugin-boundaries; framework/I-O packages per layer
 * are restricted with `no-restricted-imports`; cycles between modules with `import/no-cycle`.
 */
const path = require('node:path');

const eslintComments = require('@eslint-community/eslint-plugin-eslint-comments/configs');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');
const boundaries = require('eslint-plugin-boundaries');
const globals = require('globals');
const jestPlugin = require('eslint-plugin-jest');

const {
  DOMAIN_FILES,
  APPLICATION_FILES,
  PRESENTATION_FILES,
  ADAPTER_AND_WIRING_FILES,
  TEST_FILES,
  CONTRACT_SUITE_FILES,
} = require('./layers');
const { elementDescriptors, fileDescriptors, dependencyPolicies } = require('./boundary-policies');
const {
  forbiddenImportsInInnerLayers,
  forbiddenImportsInPresentation,
  forbiddenImportsInProductionAdapters,
} = require('./restricted-imports');

/** Re-exports only; the coverage exclusion of module barrels relies on this (ADR-001). */
const MODULE_INDEX_FILES = ['src/modules/*/index.ts'];

const TYPESCRIPT_FILES = ['**/*.{ts,tsx}'];

/**
 * @param {{ rootDir: string }} options
 * @returns {import('eslint').Linter.Config[]}
 */
function createEslintConfig({ rootDir }) {
  return [
    {
      ignores: [
        'node_modules/**',
        'coverage/**',
        'reports/**',
        'dist/**',
        '.expo/**',
        '.stryker-tmp/**',
        'android/**',
        'ios/**',
        '**/__fixtures__/**',
        'src/shared/infrastructure/db/migrations/**',
      ],
    },
    ...expoConfig,
    eslintComments.recommended,
    {
      linterOptions: { reportUnusedDisableDirectives: 'error' },
      settings: {
        'import/resolver': {
          typescript: { project: path.join(rootDir, 'tsconfig.json') },
          node: true,
        },
        'boundaries/root-path': rootDir,
        'boundaries/include': ['src/**/*', 'app/**/*', 'test/**/*'],
        'boundaries/elements': elementDescriptors,
        'boundaries/files': fileDescriptors,
      },
      plugins: { boundaries },
      rules: {
        'boundaries/dependencies': ['error', { default: 'disallow', policies: dependencyPolicies }],
        // Every file under src/, app/ and test/ must belong to a known element (ADR-001); a new kind
        // of folder is an architecture decision, not an accident.
        'boundaries/no-unknown-files': 'error',
        'import/no-cycle': ['error', { ignoreExternal: true, disableScc: true }],
        '@eslint-community/eslint-comments/require-description': ['error', { ignore: [] }],
        '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
        // Logging goes through the Logger port; only its console adapter may touch `console`.
        'no-console': 'error',
        eqeqeq: ['error', 'always'],
      },
    },
    {
      // Node-side configuration and build tooling (CommonJS, run by Node, never bundled).
      files: ['*.config.js', 'tooling/**/*.js'],
      languageOptions: { globals: globals.node, sourceType: 'commonjs' },
    },
    {
      files: TYPESCRIPT_FILES,
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/ban-ts-comment': [
          'error',
          {
            'ts-ignore': true,
            'ts-nocheck': true,
            'ts-check': false,
            'ts-expect-error': 'allow-with-description',
          },
        ],
        '@typescript-eslint/no-unused-vars': [
          'error',
          { args: 'after-used', argsIgnorePattern: '^_', ignoreRestSiblings: true },
        ],
      },
    },
    {
      files: ['src/shared/infrastructure/logging/**/*.{ts,tsx}', 'tooling/**/*.js'],
      rules: { 'no-console': 'off' },
    },
    {
      files: [...DOMAIN_FILES, ...APPLICATION_FILES],
      rules: {
        '@typescript-eslint/no-non-null-assertion': 'error',
        'no-restricted-imports': ['error', forbiddenImportsInInnerLayers],
      },
    },
    {
      files: PRESENTATION_FILES,
      rules: {
        'no-restricted-imports': ['error', forbiddenImportsInPresentation],
      },
    },
    {
      files: ADAPTER_AND_WIRING_FILES,
      ignores: TEST_FILES,
      rules: {
        'no-restricted-imports': ['error', forbiddenImportsInProductionAdapters],
      },
    },
    {
      // Time must come through the Clock port (S0-14); infrastructure adapters may read it.
      files: [...DOMAIN_FILES, ...APPLICATION_FILES, ...PRESENTATION_FILES],
      rules: {
        'no-restricted-properties': [
          'error',
          { object: 'Date', property: 'now', message: 'Use the Clock port instead of Date.now().' },
          {
            object: 'performance',
            property: 'now',
            message: 'Use the Clock port instead of performance.now().',
          },
        ],
        'no-restricted-syntax': [
          'error',
          {
            selector: "NewExpression[callee.name='Date'][arguments.length=0]",
            message: 'Use the Clock port instead of new Date().',
          },
          {
            selector: "CallExpression[callee.name='Date']",
            message: 'Use the Clock port instead of Date().',
          },
        ],
      },
    },
    {
      files: MODULE_INDEX_FILES,
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector:
              'Program > :not(ExportNamedDeclaration[source], ExportAllDeclaration, ImportDeclaration[importKind="type"])',
            message:
              'A module index.ts is its public API and may only re-export (`export … from`). Move logic into a layer.',
          },
        ],
      },
    },
    {
      files: TEST_FILES,
      ...jestPlugin.configs['flat/recommended'],
      rules: {
        ...jestPlugin.configs['flat/recommended'].rules,
        'jest/no-focused-tests': 'error',
        'jest/no-disabled-tests': 'error',
        'jest/no-commented-out-tests': 'error',
        'jest/expect-expect': ['error', { assertFunctionNames: ['expect', 'fc.assert'] }],
      },
    },
    {
      // A contract suite is written once and imported by the test of every implementation of the
      // port, so it must export the function that registers its cases (test/contracts/README.md).
      // Ordinary test files still may not export anything.
      files: CONTRACT_SUITE_FILES,
      rules: { 'jest/no-export': 'off' },
    },
    prettierConfig,
  ];
}

module.exports = { createEslintConfig };
