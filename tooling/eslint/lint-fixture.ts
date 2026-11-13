/**
 * Test support for the ESLint rule tests: lints source text as if it lived at a given path of the
 * fixture project, using the real project configuration factory.
 */
import path from 'node:path';

import { ESLint } from 'eslint';

import { createEslintConfig } from './create-eslint-config';

export const FIXTURE_ROOT = path.join(__dirname, '__fixtures__', 'project');

const ERROR_SEVERITY = 2;

export interface LintError {
  readonly ruleId: string | null;
  readonly message: string;
}

export interface FixtureLinter {
  /** Lints `code` as a virtual file at `relativePath` (relative to the fixture project root). */
  lintAs(relativePath: string, code: string): Promise<readonly LintError[]>;
  /** Lints a real file of the fixture project. */
  lintFile(relativePath: string): Promise<readonly LintError[]>;
}

const toErrors = (results: readonly ESLint.LintResult[]): readonly LintError[] =>
  results
    .flatMap((result) => result.messages)
    .filter((message) => message.severity === ERROR_SEVERITY)
    .map(({ ruleId, message }) => ({ ruleId, message }));

export function createFixtureLinter(): FixtureLinter {
  const eslint = new ESLint({
    cwd: FIXTURE_ROOT,
    overrideConfigFile: true,
    overrideConfig: createEslintConfig({ rootDir: FIXTURE_ROOT }),
  });
  return {
    lintAs: async (relativePath, code) =>
      toErrors(await eslint.lintText(code, { filePath: path.join(FIXTURE_ROOT, relativePath) })),
    lintFile: async (relativePath) =>
      toErrors(await eslint.lintFiles([path.join(FIXTURE_ROOT, relativePath)])),
  };
}

export const ruleIdsOf = (errors: readonly LintError[]): readonly (string | null)[] =>
  errors.map((error) => error.ruleId);
