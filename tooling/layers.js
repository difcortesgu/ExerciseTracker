// @ts-check
/**
 * Single source of truth for which files belong to which layer, shared by the coverage policy
 * (jest.config.js) and the lint configuration (tooling/eslint). Globs are micromatch/minimatch
 * compatible (brace expansion), so the same string works in both tools.
 */
const LAYER_GLOBS = Object.freeze({
  domain: 'src/{shared,modules/*}/domain/**/*.{ts,tsx}',
  application: 'src/{shared,modules/*}/application/**/*.{ts,tsx}',
  infrastructure: 'src/{shared,modules/*}/infrastructure/**/*.{ts,tsx}',
  presentation: 'src/{modules/*/presentation,shared/ui}/**/*.{ts,tsx}',
  core: 'src/core/**/*.{ts,tsx}',
});

module.exports = { LAYER_GLOBS };
