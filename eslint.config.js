// The configuration is built by a factory so the rule tests in tooling/eslint can lint fixture
// files with exactly the same rules (ADR-001 "Boundary enforcement").
const { createEslintConfig } = require('./tooling/eslint/create-eslint-config');

module.exports = createEslintConfig({ rootDir: __dirname });
