/**
 * S0-07: framework, database and device-service packages are restricted per layer
 * (`no-restricted-imports`). Split from boundaries.test.ts by concern (S1-03).
 */
import {
  createFixtureLinter,
  RESTRICTED_IMPORT,
  importing,
  ruleIdsOf,
  type FixtureLinter,
} from './lint-fixture';

let linter: FixtureLinter;

beforeAll(() => {
  linter = createFixtureLinter();
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

  it.each(['expo-application', 'expo-constants', 'expo-file-system', 'expo-intent-launcher'])(
    'rejects a presentation file reading app/device information or files through %s directly (Sprint 0.5, ADR-003)',
    async (pkg) => {
      const errors = await linter.lintAs('src/modules/alpha/presentation/x.tsx', importing(pkg));

      expect(ruleIdsOf(errors)).toContain(RESTRICTED_IMPORT);
    },
  );

  it.each(['expo-image-picker', 'expo-image-manipulator'])(
    'rejects a presentation file picking or transforming photos through %s directly (Sprint 1, ADR-004)',
    async (pkg) => {
      const errors = await linter.lintAs('src/modules/alpha/presentation/x.tsx', importing(pkg));

      expect(ruleIdsOf(errors)).toContain(RESTRICTED_IMPORT);
    },
  );

  it.each(['expo-image', 'expo-image-manipulator', 'expo-image-picker'])(
    'rejects a domain or application file importing %s',
    async (pkg) => {
      const domainErrors = await linter.lintAs('src/modules/alpha/domain/x.ts', importing(pkg));
      const applicationErrors = await linter.lintAs(
        'src/modules/alpha/application/x.ts',
        importing(pkg),
      );

      expect(ruleIdsOf(domainErrors)).toContain(RESTRICTED_IMPORT);
      expect(ruleIdsOf(applicationErrors)).toContain(RESTRICTED_IMPORT);
    },
  );

  it.each(['react', 'react-native', 'expo-router', 'expo-image', '@expo/vector-icons'])(
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

describe('bundled exercise dataset (Sprint 1, ADR-004)', () => {
  const SEED_ASSET = '@assets/exercise-db/exercises.json';

  it.each([
    'src/modules/alpha/domain/x.ts',
    'src/modules/alpha/application/x.ts',
    'src/modules/alpha/presentation/x.tsx',
    'src/shared/ui/x.tsx',
    'app/(tabs)/x.tsx',
  ])(
    'rejects %s reading the seed asset directly (it is read by the seed source adapter)',
    async (file) => {
      const errors = await linter.lintAs(file, importing(SEED_ASSET));

      expect(ruleIdsOf(errors)).toContain(RESTRICTED_IMPORT);
    },
  );

  it('rejects a relative import of the seed asset from presentation', async () => {
    const errors = await linter.lintAs(
      'src/modules/alpha/presentation/x.tsx',
      importing('../../../../assets/exercise-db/manifest.json'),
    );

    expect(ruleIdsOf(errors)).toContain(RESTRICTED_IMPORT);
  });

  it('allows a module infrastructure adapter to read the seed asset', async () => {
    const errors = await linter.lintAs(
      'src/modules/alpha/infrastructure/x.ts',
      importing(SEED_ASSET),
    );

    expect(errors).toEqual([]);
  });
});
