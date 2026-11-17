import { openDatabaseSync } from 'expo-sqlite';

import { BootstrapperToken } from '@core/bootstrap/bootstrapper';
import { ApkDownloaderToken } from '@modules/updates/application/apk-downloader';
import { ApkInstallerToken } from '@modules/updates/application/apk-installer';
import { CheckForUpdateToken } from '@modules/updates/application/check-for-update';
import { DownloadUpdateToken } from '@modules/updates/application/download-update';
import { InstallUpdateToken } from '@modules/updates/application/install-update';
import { ReleaseSourceToken } from '@modules/updates/application/release-source';
import { UpdateOfferDismissalToken } from '@modules/updates/application/update-offer-dismissal';
import { ExpoApkDownloader } from '@modules/updates/infrastructure/expo-apk-downloader';
import { GitHubReleaseSource } from '@modules/updates/infrastructure/github-release-source';
import { IntentApkInstaller } from '@modules/updates/infrastructure/intent-apk-installer';
import { ClockToken } from '@shared/application/clock';
import { DatabaseMigratorToken } from '@shared/application/database-migrator';
import { IdGeneratorToken } from '@shared/application/id-generator';
import { InstalledAppInfoToken } from '@shared/application/installed-app-info';
import { LoggerToken } from '@shared/application/logger';
import { ExpoInstalledAppInfo } from '@shared/infrastructure/app-info/expo-installed-app-info';
import { SqliteDatabaseMigrator } from '@shared/infrastructure/db/sqlite-database-migrator';
import { CryptoIdGenerator } from '@shared/infrastructure/ids/crypto-id-generator';
import { ConsoleLogger } from '@shared/infrastructure/logging/console-logger';
import { SystemClock } from '@shared/infrastructure/time/system-clock';
import { unwrapErr } from '@test/support/unwrap';

import { createProductionContainer, DATABASE_FILE_NAME } from './composition-root';
import type { Resolver } from './container';

// Native module boundaries (not available in Jest). Real behaviour of the adapters is covered by
// their own tests and contract suites; this test proves the wiring.
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => {
    throw new Error('no native SQLite in Jest');
  }),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => '9b2f6c1e-0d7a-4c3b-8e5f-1a2b3c4d5e6f' }));
jest.mock('expo-file-system', () =>
  jest.requireActual<typeof import('@test/support/in-memory-expo-file-system')>(
    '@test/support/in-memory-expo-file-system',
  ),
);
jest.mock('expo-intent-launcher', () => ({ startActivityAsync: jest.fn() }));
// The exercises photo adapters import these at module load (exercises wiring: its own tests).
jest.mock('expo-image-picker', () =>
  jest.requireActual<typeof import('@test/support/in-memory-image-picker')>(
    '@test/support/in-memory-image-picker',
  ),
);
jest.mock('expo-image-manipulator', () =>
  jest.requireActual<typeof import('@test/support/in-memory-image-manipulator')>(
    '@test/support/in-memory-image-manipulator',
  ),
);

describe('createProductionContainer', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['Clock', (container: Resolver) => container.resolve(ClockToken), SystemClock],
    [
      'IdGenerator',
      (container: Resolver) => container.resolve(IdGeneratorToken),
      CryptoIdGenerator,
    ],
    ['Logger', (container: Resolver) => container.resolve(LoggerToken), ConsoleLogger],
    [
      'DatabaseMigrator',
      (container: Resolver) => container.resolve(DatabaseMigratorToken),
      SqliteDatabaseMigrator,
    ],
    [
      'InstalledAppInfo',
      (container: Resolver) => container.resolve(InstalledAppInfoToken),
      ExpoInstalledAppInfo,
    ],
    [
      'ReleaseSource',
      (container: Resolver) => container.resolve(ReleaseSourceToken),
      GitHubReleaseSource,
    ],
    [
      'ApkDownloader',
      (container: Resolver) => container.resolve(ApkDownloaderToken),
      ExpoApkDownloader,
    ],
    [
      'ApkInstaller',
      (container: Resolver) => container.resolve(ApkInstallerToken),
      IntentApkInstaller,
    ],
  ] as const)('wires the %s port to its production adapter', (_port, resolvePort, adapter) => {
    expect(resolvePort(createProductionContainer())).toBeInstanceOf(adapter);
  });

  it('does not open the database until something needs it', () => {
    createProductionContainer().resolve(BootstrapperToken);

    expect(openDatabaseSync).not.toHaveBeenCalled();
  });

  it('wires a bootstrapper that opens the app database and reports failures', async () => {
    const bootstrap = createProductionContainer().resolve(BootstrapperToken);

    const error = unwrapErr(await bootstrap());

    expect(openDatabaseSync).toHaveBeenCalledWith(DATABASE_FILE_NAME);
    expect(error).toMatchObject({
      code: 'db.openFailed',
      details: { cause: 'no native SQLite in Jest' },
    });
    expect(consoleError).toHaveBeenCalled();
  });

  describe('self-update (Sprint 0.5)', () => {
    let fetchSpy: jest.SpyInstance;

    beforeEach(() => {
      fetchSpy = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no network'));
    });

    it('wires the update use cases', () => {
      const container = createProductionContainer();

      expect(typeof container.resolve(CheckForUpdateToken)).toBe('function');
      expect(typeof container.resolve(DownloadUpdateToken)).toBe('function');
      expect(typeof container.resolve(InstallUpdateToken)).toBe('function');
    });

    it('shares one memoized update check per container (at most one request per launch)', () => {
      const container = createProductionContainer();

      expect(container.resolve(CheckForUpdateToken)).toBe(container.resolve(CheckForUpdateToken));
    });

    it('keeps a dismissed offer for the whole launch, but not into the next one (QA-05-1)', () => {
      const thisLaunch = createProductionContainer();

      thisLaunch.resolve(UpdateOfferDismissalToken).dismiss();

      expect(thisLaunch.resolve(UpdateOfferDismissalToken).isDismissed()).toBe(true);
      expect(createProductionContainer().resolve(UpdateOfferDismissalToken).isDismissed()).toBe(
        false,
      );
    });

    it('keeps the updater inactive in a development bundle, without any request', async () => {
      const checkForUpdate = createProductionContainer().resolve(CheckForUpdateToken);

      expect(await checkForUpdate()).toEqual({ kind: 'inactive' });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("lets the GitHub adapter call the platform's fetch", async () => {
      const source = createProductionContainer().resolve(ReleaseSourceToken);

      const result = await source.fetchLatestRelease();

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.github.com/repos/difcortesgu/ExerciseTracker/releases/latest',
        expect.objectContaining({ signal: expect.any(AbortSignal) as unknown }),
      );
      expect(result).toMatchObject({ ok: false, error: { code: 'updates.networkUnavailable' } });
    });
  });

  it('creates independent containers', () => {
    expect(createProductionContainer().resolve(ClockToken)).not.toBe(
      createProductionContainer().resolve(ClockToken),
    );
  });
});
