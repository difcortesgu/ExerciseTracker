/**
 * S0-02: the project compiler options reject unsafe code. Fixtures are compiled with the options
 * parsed from the real tsconfig.json, so loosening tsconfig makes these tests fail.
 */
import path from 'node:path';

import ts from 'typescript';

const ROOT = path.join(__dirname, '..', '..');
const FIXTURES = path.join(__dirname, '__fixtures__');
const OBJECT_POSSIBLY_UNDEFINED = [2532, 18048];

function projectCompilerOptions(): ts.CompilerOptions {
  const configPath = path.join(ROOT, 'tsconfig.json');
  const { config } = ts.readConfigFile(configPath, (file) => ts.sys.readFile(file));
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, ROOT);
  // Fixtures need no ambient test/runtime types; keeps the compile fast and isolated.
  return { ...parsed.options, types: [], noEmit: true };
}

function diagnosticCodes(fixture: string): readonly number[] {
  const program = ts.createProgram([path.join(FIXTURES, fixture)], projectCompilerOptions());
  return ts.getPreEmitDiagnostics(program).map((diagnostic) => diagnostic.code);
}

describe('TypeScript strictness', () => {
  it('enables strict mode and noUncheckedIndexedAccess', () => {
    const options = projectCompilerOptions();

    expect(options.strict).toBe(true);
    expect(options.noUncheckedIndexedAccess).toBe(true);
  });

  it('rejects reading array[0].name without checking for undefined', () => {
    const codes = diagnosticCodes('unchecked-index.ts');

    expect(codes.some((code) => OBJECT_POSSIBLY_UNDEFINED.includes(code))).toBe(true);
  });

  it('accepts the same read once undefined is handled', () => {
    expect(diagnosticCodes('checked-index.ts')).toEqual([]);
  });
});
