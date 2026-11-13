/**
 * Babel config shared by Metro (app bundle) and Jest (babel-jest via jest-expo).
 * `inline-import` turns `import sql from './0000_init.sql'` into a string literal, so drizzle-kit
 * migrations bundle identically in Expo Go and in Jest (ADR-001 "Migrations").
 */
module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
