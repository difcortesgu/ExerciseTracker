/** eslint-config-expo ships no type declarations; it exports a flat config array. */
declare module 'eslint-config-expo/flat' {
  import type { Linter } from 'eslint';

  const config: Linter.Config[];
  export = config;
}
