/**
 * S0-07: module boundaries (public index.ts only, no cycles), the composition root as the only
 * place that constructs adapters, and what expo-router routes may import. Split from
 * boundaries.test.ts by concern (S1-03).
 */
import {
  createFixtureLinter,
  BOUNDARIES,
  importing,
  ruleIdsOf,
  type FixtureLinter,
} from './lint-fixture';

let linter: FixtureLinter;

beforeAll(() => {
  linter = createFixtureLinter();
});

describe('composition root (adapter construction only in src/core/di)', () => {
  it.each([
    '@modules/alpha/infrastructure/alpha-infrastructure',
    '@shared/infrastructure/shared-infrastructure',
    '@modules/alpha',
  ])('allows src/core/di to import %s', async (specifier) => {
    const errors = await linter.lintAs('src/core/di/composition-root.ts', importing(specifier));

    expect(errors).toEqual([]);
  });

  it.each([
    ['src/core/bootstrap/x.ts', '@shared/infrastructure/shared-infrastructure'],
    ['src/core/presentation/x.tsx', '@modules/alpha/infrastructure/alpha-infrastructure'],
    ['src/modules/alpha/application/x.ts', '@shared/infrastructure/shared-infrastructure'],
    ['app/index.tsx', '@modules/alpha/infrastructure/alpha-infrastructure'],
  ])('rejects %s importing the adapter %s', async (file, specifier) => {
    const errors = await linter.lintAs(file, importing(specifier));

    expect(ruleIdsOf(errors)).toContain(BOUNDARIES);
  });

  it('rejects presentation importing the composition root', async () => {
    const errors = await linter.lintAs(
      'src/modules/alpha/presentation/x.tsx',
      importing('@core/di/container'),
    );

    expect(ruleIdsOf(errors)).toContain(BOUNDARIES);
  });
});

describe('module boundaries', () => {
  it.each([
    ['src/modules/alpha/domain/x.ts', '@modules/beta/domain/beta-domain'],
    ['src/modules/alpha/application/x.ts', '@modules/beta/application/beta-application'],
    ['src/modules/alpha/application/x.ts', '../../beta/domain/beta-domain'],
    ['src/modules/alpha/presentation/x.tsx', '@modules/beta/presentation/beta-presentation'],
    ['src/modules/alpha/infrastructure/x.ts', '@modules/beta/infrastructure/beta-infrastructure'],
    ['app/index.tsx', '@modules/alpha/presentation/alpha-presentation'],
  ])('rejects %s reaching into another module internal file %s', async (file, specifier) => {
    const errors = await linter.lintAs(file, importing(specifier));

    expect(ruleIdsOf(errors)).toContain(BOUNDARIES);
  });

  it.each([
    'src/modules/alpha/application/x.ts',
    'src/modules/alpha/presentation/x.tsx',
    'src/modules/alpha/infrastructure/x.ts',
    'app/index.tsx',
  ])('allows %s to import another module through its public index.ts', async (file) => {
    const errors = await linter.lintAs(file, importing('@modules/beta'));

    expect(errors).toEqual([]);
  });

  it('rejects a domain importing another module, even through its index.ts', async () => {
    const errors = await linter.lintAs('src/modules/alpha/domain/x.ts', importing('@modules/beta'));

    expect(ruleIdsOf(errors)).toContain(BOUNDARIES);
  });

  it('rejects a cycle between two modules public APIs', async () => {
    const errors = await linter.lintFile('src/modules/gamma/application/gamma-use-case.ts');

    expect(ruleIdsOf(errors)).toContain('import/no-cycle');
  });

  it('rejects a module index.ts exposing its infrastructure', async () => {
    const errors = await linter.lintAs(
      'src/modules/alpha/index.ts',
      "export { alpha_infrastructure } from './infrastructure/alpha-infrastructure';\n",
    );

    expect(ruleIdsOf(errors)).toContain(BOUNDARIES);
  });

  it('rejects logic inside a module index.ts (re-exports only)', async () => {
    const errors = await linter.lintAs(
      'src/modules/alpha/index.ts',
      'export const answer = (): number => 42;\n',
    );

    expect(ruleIdsOf(errors)).toContain('no-restricted-syntax');
  });

  it('allows a module index.ts re-exporting its application and presentation', async () => {
    const errors = await linter.lintAs(
      'src/modules/alpha/index.ts',
      "export { alpha_application } from './application/alpha-application';\nexport { alpha_presentation } from './presentation/alpha-presentation';\n",
    );

    expect(errors).toEqual([]);
  });
});

describe('app routes', () => {
  it.each([
    '@modules/alpha',
    '@core/presentation/use-dependency',
    '@core/di/container',
    '@shared/ui/shared-ui',
  ])('allows an app/ route to import %s', async (specifier) => {
    const errors = await linter.lintAs('app/(tabs)/index.tsx', importing(specifier));

    expect(errors).toEqual([]);
  });
});
