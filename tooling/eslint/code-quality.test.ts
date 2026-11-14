/**
 * S0-03: code-quality rules from docs/ENGINEERING_STANDARDS.md §3–§5 make lint fail.
 */
import { createFixtureLinter, ruleIdsOf, type FixtureLinter } from './lint-fixture';

let linter: FixtureLinter;

beforeAll(() => {
  linter = createFixtureLinter();
});

describe('type-safety shortcuts', () => {
  it('rejects `any`', async () => {
    const errors = await linter.lintAs(
      'src/modules/alpha/presentation/x.ts',
      'export const parse = (raw: any): string => String(raw);\n',
    );

    expect(ruleIdsOf(errors)).toContain('@typescript-eslint/no-explicit-any');
  });

  it('rejects `@ts-ignore`', async () => {
    const errors = await linter.lintAs(
      'src/modules/alpha/presentation/x.ts',
      '// @ts-ignore\nexport const value: number = 1;\n',
    );

    expect(ruleIdsOf(errors)).toContain('@typescript-eslint/ban-ts-comment');
  });

  it('allows `@ts-expect-error` with a description (compile-time type tests)', async () => {
    const errors = await linter.lintAs(
      'src/shared/domain/id.test.ts',
      "// @ts-expect-error -- an ExerciseId is not a RoutineId\nexport const value: number = 'x';\n",
    );

    expect(errors).toEqual([]);
  });

  it.each([
    'src/shared/domain/x.ts',
    'src/modules/alpha/domain/x.ts',
    'src/modules/alpha/application/x.ts',
  ])('rejects a non-null assertion in %s', async (file) => {
    const errors = await linter.lintAs(
      file,
      'export const first = (items: readonly string[]): string => items[0]!;\n',
    );

    expect(ruleIdsOf(errors)).toContain('@typescript-eslint/no-non-null-assertion');
  });

  it('rejects an eslint-disable comment without a justification', async () => {
    const errors = await linter.lintAs(
      'src/modules/alpha/presentation/x.ts',
      '// eslint-disable-next-line no-console\nconsole.log("x");\n',
    );

    expect(ruleIdsOf(errors)).toContain('@eslint-community/eslint-comments/require-description');
  });
});

describe('logging goes through the Logger port', () => {
  it.each(['log', 'info', 'warn', 'error'])(
    'rejects console.%s outside the logger adapter',
    async (method) => {
      const errors = await linter.lintAs(
        'src/modules/alpha/presentation/x.ts',
        `export const report = (): void => console.${method}('x');\n`,
      );

      expect(ruleIdsOf(errors)).toContain('no-console');
    },
  );

  it('allows the console logger adapter in shared infrastructure', async () => {
    const errors = await linter.lintAs(
      'src/shared/infrastructure/logging/console-logger.ts',
      "export const report = (): void => console.error('x');\n",
    );

    expect(errors).toEqual([]);
  });
});

describe('disabled or focused tests', () => {
  it.each([
    "it.only('x', () => { expect(1).toBe(1); });",
    "describe.only('x', () => { it('y', () => { expect(1).toBe(1); }); });",
    "fit('x', () => { expect(1).toBe(1); });",
  ])('rejects the focused test %s', async (code) => {
    const errors = await linter.lintAs('src/modules/alpha/domain/x.test.ts', `${code}\n`);

    expect(ruleIdsOf(errors)).toContain('jest/no-focused-tests');
  });

  it.each([
    "it.skip('x', () => { expect(1).toBe(1); });",
    "xit('x', () => { expect(1).toBe(1); });",
    "xdescribe('x', () => { it('y', () => { expect(1).toBe(1); }); });",
  ])('rejects the disabled test %s', async (code) => {
    const errors = await linter.lintAs('src/modules/alpha/domain/x.test.ts', `${code}\n`);

    expect(ruleIdsOf(errors)).toContain('jest/no-disabled-tests');
  });

  it('rejects a test without an assertion', async () => {
    const errors = await linter.lintAs(
      'src/modules/alpha/domain/x.test.ts',
      "it('does nothing', () => { const value = 1 + 1; return value; });\n",
    );

    expect(ruleIdsOf(errors)).toContain('jest/expect-expect');
  });

  describe('shared contract suites', () => {
    const contractSuite =
      "export const describeThingContract = (name: string): void => {\n  describe(`Thing contract: ${name}`, () => {\n    it('works', () => {\n      expect(1).toBe(1);\n    });\n  });\n};\n";

    it('allows a contract suite under test/contracts to export the function that registers its cases', async () => {
      const errors = await linter.lintAs('test/contracts/thing.contract.ts', contractSuite);

      expect(errors).toEqual([]);
    });

    it('allows nested contract suites under test/contracts', async () => {
      const errors = await linter.lintAs('test/contracts/thing/thing.contract.ts', contractSuite);

      expect(errors).toEqual([]);
    });

    it('still rejects exports from an ordinary test file', async () => {
      const errors = await linter.lintAs('src/modules/alpha/domain/x.test.ts', contractSuite);

      expect(ruleIdsOf(errors)).toContain('jest/no-export');
    });
  });

  it('accepts a fast-check property as an assertion', async () => {
    const errors = await linter.lintAs(
      'src/modules/alpha/domain/x.test.ts',
      "import * as fc from 'fast-check';\n\nit('holds', () => {\n  fc.assert(fc.property(fc.integer(), (n) => n === n));\n});\n",
    );

    expect(errors).toEqual([]);
  });
});

describe('reading the clock directly (must go through the Clock port)', () => {
  const layersWithoutClockAccess = [
    'src/shared/domain/x.ts',
    'src/modules/alpha/domain/x.ts',
    'src/modules/alpha/application/x.ts',
    'src/modules/alpha/presentation/x.tsx',
  ];

  it.each(layersWithoutClockAccess)('rejects Date.now() in %s', async (file) => {
    const errors = await linter.lintAs(file, 'export const now = (): number => Date.now();\n');

    expect(ruleIdsOf(errors)).toContain('no-restricted-properties');
  });

  it.each(layersWithoutClockAccess)('rejects new Date() in %s', async (file) => {
    const errors = await linter.lintAs(file, 'export const now = (): Date => new Date();\n');

    expect(ruleIdsOf(errors)).toContain('no-restricted-syntax');
  });

  it('allows converting a known timestamp with new Date(ms)', async () => {
    const errors = await linter.lintAs(
      'src/modules/alpha/domain/x.ts',
      'export const toDate = (ms: number): Date => new Date(ms);\n',
    );

    expect(errors).toEqual([]);
  });

  it('allows the system clock adapter in infrastructure to read the clock', async () => {
    const errors = await linter.lintAs(
      'src/shared/infrastructure/system-clock.ts',
      'export const now = (): number => Date.now();\n',
    );

    expect(errors).toEqual([]);
  });
});

describe('network access (must go through a port, ADR-003)', () => {
  const layersWithoutNetworkAccess = [
    'src/shared/domain/x.ts',
    'src/modules/alpha/domain/x.ts',
    'src/modules/alpha/application/x.ts',
    'src/modules/alpha/presentation/x.tsx',
    'src/core/presentation/x.tsx',
  ];

  it.each(layersWithoutNetworkAccess)('rejects fetch() in %s', async (file) => {
    const errors = await linter.lintAs(
      file,
      "export const load = (): Promise<unknown> => fetch('https://example.com');\n",
    );

    expect(ruleIdsOf(errors)).toContain('no-restricted-globals');
  });

  it.each(layersWithoutNetworkAccess)('rejects XMLHttpRequest in %s', async (file) => {
    const errors = await linter.lintAs(
      file,
      'export const request = (): XMLHttpRequest => new XMLHttpRequest();\n',
    );

    expect(ruleIdsOf(errors)).toContain('no-restricted-globals');
  });

  it('allows an infrastructure adapter to use fetch', async () => {
    const errors = await linter.lintAs(
      'src/modules/alpha/infrastructure/x.ts',
      "export const load = (): Promise<unknown> => fetch('https://example.com');\n",
    );

    expect(errors).toEqual([]);
  });
});
