/**
 * S0-07: layer and module boundaries are enforced by lint. Each case lints a virtual file placed in
 * the fixture project and asserts the boundary error (or its absence).
 */
import fs from 'node:fs';
import path from 'node:path';

import { createFixtureLinter, FIXTURE_ROOT, ruleIdsOf, type FixtureLinter } from './lint-fixture';

const BOUNDARIES = 'boundaries/dependencies';
const RESTRICTED_IMPORT = 'no-restricted-imports';

const importing = (specifier: string): string =>
  `import * as target from '${specifier}';\n\nexport const used = target;\n`;

let linter: FixtureLinter;

beforeAll(() => {
  linter = createFixtureLinter();
});

describe('fixture project', () => {
  it('uses the same path aliases as the real project', () => {
    const readPaths = (file: string): unknown =>
      JSON.parse(fs.readFileSync(file, 'utf8')).compilerOptions.paths;

    expect(readPaths(path.join(FIXTURE_ROOT, 'tsconfig.json'))).toEqual(
      readPaths(path.join(__dirname, '..', '..', 'tsconfig.json')),
    );
  });
});

describe('layer dependency rule', () => {
  it.each([
    ['shared domain', 'src/shared/domain/x.ts', '@shared/application/shared-application'],
    ['module domain', 'src/modules/alpha/domain/x.ts', '../application/alpha-application'],
    ['module domain', 'src/modules/alpha/domain/x.ts', '../infrastructure/alpha-infrastructure'],
    ['module domain', 'src/modules/alpha/domain/x.ts', '../presentation/alpha-presentation'],
    [
      'module domain',
      'src/modules/alpha/domain/x.ts',
      '@shared/infrastructure/shared-infrastructure',
    ],
    [
      'module application',
      'src/modules/alpha/application/x.ts',
      '../infrastructure/alpha-infrastructure',
    ],
    [
      'module application',
      'src/modules/alpha/application/x.ts',
      '../presentation/alpha-presentation',
    ],
    [
      'shared application',
      'src/shared/application/x.ts',
      '@shared/infrastructure/shared-infrastructure',
    ],
    [
      'module infrastructure',
      'src/modules/alpha/infrastructure/x.ts',
      '../presentation/alpha-presentation',
    ],
    [
      'module presentation',
      'src/modules/alpha/presentation/x.ts',
      '../infrastructure/alpha-infrastructure',
    ],
    [
      'module presentation',
      'src/modules/alpha/presentation/x.ts',
      '@shared/infrastructure/shared-infrastructure',
    ],
    ['shared ui', 'src/shared/ui/x.ts', '@shared/infrastructure/shared-infrastructure'],
  ])('rejects %s (%s) importing %s', async (_layer, file, specifier) => {
    const errors = await linter.lintAs(file, importing(specifier));

    expect(ruleIdsOf(errors)).toContain(BOUNDARIES);
  });

  it.each([
    ['module domain', 'src/modules/alpha/domain/x.ts', '@shared/domain/shared-domain'],
    ['module domain', 'src/modules/alpha/domain/x.ts', './alpha-domain'],
    ['module application', 'src/modules/alpha/application/x.ts', '../domain/alpha-domain'],
    [
      'module application',
      'src/modules/alpha/application/x.ts',
      '@shared/application/shared-application',
    ],
    [
      'module infrastructure',
      'src/modules/alpha/infrastructure/x.ts',
      '../application/alpha-application',
    ],
    ['module infrastructure', 'src/modules/alpha/infrastructure/x.ts', '../domain/alpha-domain'],
    [
      'module infrastructure',
      'src/modules/alpha/infrastructure/x.ts',
      '@shared/infrastructure/shared-infrastructure',
    ],
    [
      'module presentation',
      'src/modules/alpha/presentation/x.ts',
      '../application/alpha-application',
    ],
    ['module presentation', 'src/modules/alpha/presentation/x.ts', '@shared/ui/shared-ui'],
    [
      'module presentation',
      'src/modules/alpha/presentation/x.ts',
      '@core/presentation/use-dependency',
    ],
    [
      'shared infrastructure',
      'src/shared/infrastructure/x.ts',
      '@shared/application/shared-application',
    ],
  ])('allows %s (%s) importing %s', async (_layer, file, specifier) => {
    const errors = await linter.lintAs(file, importing(specifier));

    expect(errors).toEqual([]);
  });
});

describe('framework and I/O imports in inner layers', () => {
  const forbiddenInDomainAndApplication = [
    'react',
    'react-native',
    'expo',
    'expo-sqlite',
    'expo-router',
    '@expo/vector-icons',
    'drizzle-orm',
    'drizzle-orm/sqlite-core',
    'zustand',
    'better-sqlite3',
  ];

  it.each(forbiddenInDomainAndApplication)('rejects a domain file importing %s', async (pkg) => {
    const errors = await linter.lintAs('src/modules/alpha/domain/x.ts', importing(pkg));

    expect(ruleIdsOf(errors)).toContain(RESTRICTED_IMPORT);
  });

  it.each(forbiddenInDomainAndApplication)(
    'rejects an application file importing %s',
    async (pkg) => {
      const errors = await linter.lintAs('src/shared/application/x.ts', importing(pkg));

      expect(ruleIdsOf(errors)).toContain(RESTRICTED_IMPORT);
    },
  );

  it.each(['expo-sqlite', 'drizzle-orm', 'better-sqlite3', 'expo-audio', 'expo-notifications'])(
    'rejects a presentation file calling the I/O package %s directly',
    async (pkg) => {
      const errors = await linter.lintAs('src/modules/alpha/presentation/x.tsx', importing(pkg));

      expect(ruleIdsOf(errors)).toContain(RESTRICTED_IMPORT);
    },
  );

  it.each(['react', 'react-native', 'expo-router'])(
    'allows a presentation file importing the UI package %s',
    async (pkg) => {
      const errors = await linter.lintAs('src/modules/alpha/presentation/x.tsx', importing(pkg));

      expect(errors).toEqual([]);
    },
  );
});

describe('Node-only test database driver', () => {
  it.each([
    'src/shared/infrastructure/db/client.ts',
    'src/modules/alpha/infrastructure/x.ts',
    'src/core/di/composition-root.ts',
  ])(
    'rejects production file %s importing better-sqlite3 (it cannot run in Expo Go)',
    async (file) => {
      const errors = await linter.lintAs(file, importing('better-sqlite3'));

      expect(ruleIdsOf(errors)).toContain(RESTRICTED_IMPORT);
    },
  );

  it.each(['src/modules/alpha/infrastructure/x.test.ts', 'test/support/test-database.ts'])(
    'allows %s to import better-sqlite3',
    async (file) => {
      const errors = await linter.lintAs(file, importing('better-sqlite3'));

      expect(errors).toEqual([]);
    },
  );
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

describe('test support isolation', () => {
  it.each([
    ['src/modules/alpha/domain/x.ts', '@test/builders/routine.builder'],
    ['src/core/di/composition-root.ts', '@test/fakes/fake-clock'],
    ['app/index.tsx', '@test/fakes/fake-clock'],
  ])('rejects production file %s importing %s', async (file, specifier) => {
    const errors = await linter.lintAs(file, importing(specifier));

    expect(ruleIdsOf(errors)).toContain(BOUNDARIES);
  });

  it.each([
    ['src/modules/alpha/domain/x.test.ts', '@test/builders/routine.builder'],
    ['src/modules/alpha/presentation/x.test.tsx', '@test/fakes/fake-clock'],
    ['src/modules/alpha/presentation/x.test.tsx', '@core/di/container'],
  ])('allows test file %s to import %s', async (file, specifier) => {
    const errors = await linter.lintAs(file, importing(specifier));

    expect(errors).toEqual([]);
  });

  it('still applies the layer rule to test files', async () => {
    const errors = await linter.lintAs(
      'src/modules/alpha/domain/x.test.ts',
      importing('../infrastructure/alpha-infrastructure'),
    );

    expect(ruleIdsOf(errors)).toContain(BOUNDARIES);
  });
});

describe('unclassified files', () => {
  it('rejects a source file outside the agreed folder structure', async () => {
    const errors = await linter.lintAs('src/helpers/format.ts', 'export const format = 1;\n');

    expect(ruleIdsOf(errors)).toContain('boundaries/no-unknown-files');
  });

  it('rejects a source file directly in src/core outside di, bootstrap and presentation', async () => {
    const errors = await linter.lintAs('src/core/logger.ts', 'export const logger = 1;\n');

    expect(ruleIdsOf(errors)).toContain('boundaries/no-unknown-files');
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
