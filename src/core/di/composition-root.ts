import { BootstrapperToken, createBootstrapper } from '@core/bootstrap/bootstrapper';
import { ApkDownloaderToken } from '@modules/updates/application/apk-downloader';
import { ApkInstallerToken } from '@modules/updates/application/apk-installer';
import {
  CheckForUpdateToken,
  createCheckForUpdate,
} from '@modules/updates/application/check-for-update';
import {
  createDownloadUpdate,
  DownloadUpdateToken,
} from '@modules/updates/application/download-update';
import {
  createInstallUpdate,
  InstallUpdateToken,
} from '@modules/updates/application/install-update';
import { ReleaseSourceToken } from '@modules/updates/application/release-source';
import {
  createUpdateOfferDismissal,
  UpdateOfferDismissalToken,
} from '@modules/updates/application/update-offer-dismissal';
import { ExpoApkDownloader } from '@modules/updates/infrastructure/expo-apk-downloader';
import {
  GITHUB_RELEASE_REPOSITORY,
  RELEASE_CHECK_TIMEOUT_MS,
} from '@modules/updates/infrastructure/github-release-config';
import { GitHubReleaseSource } from '@modules/updates/infrastructure/github-release-source';
import { IntentApkInstaller } from '@modules/updates/infrastructure/intent-apk-installer';
import { ClockToken } from '@shared/application/clock';
import { DatabaseMigratorToken } from '@shared/application/database-migrator';
import { IdGeneratorToken } from '@shared/application/id-generator';
import { InstalledAppInfoToken } from '@shared/application/installed-app-info';
import { LoggerToken } from '@shared/application/logger';
import { createExpoInstalledAppInfo } from '@shared/infrastructure/app-info/expo-installed-app-info';
import { APP_MIGRATIONS } from '@shared/infrastructure/db/app-migrations';
import { openExpoSqliteDatabase } from '@shared/infrastructure/db/expo-sqlite-database';
import { SqliteDatabaseToken } from '@shared/infrastructure/db/sqlite-database';
import { SqliteDatabaseMigrator } from '@shared/infrastructure/db/sqlite-database-migrator';
import { CryptoIdGenerator } from '@shared/infrastructure/ids/crypto-id-generator';
import { ConsoleLogger } from '@shared/infrastructure/logging/console-logger';
import { SystemClock } from '@shared/infrastructure/time/system-clock';

import { createContainer, type Container } from './container';
import { exercisesStartupTasks, registerExercises } from './exercises-registrations';

/** The on-device SQLite file. Changing it would orphan existing user data. */
export const DATABASE_FILE_NAME = 'exercise-tracker.db';

/**
 * Composition root (Dependency Injection): the only place where infrastructure adapters are
 * constructed and wired to their ports. Everything is a lazy singleton, so nothing (not even the
 * database) is opened before the bootstrapper needs it. Call once, in `app/_layout.tsx`.
 */
export function createProductionContainer(): Container {
  return registerExercises(registerCoreAndUpdates(createContainer()));
}

/** Shared kernel adapters, startup, and the self-update module (Sprint 0 / 0.5). */
function registerCoreAndUpdates(container: Container): Container {
  return (
    container
      .register(ClockToken, () => new SystemClock())
      .register(IdGeneratorToken, () => new CryptoIdGenerator())
      .register(LoggerToken, () => new ConsoleLogger())
      .register(SqliteDatabaseToken, () => openExpoSqliteDatabase(DATABASE_FILE_NAME))
      .register(
        DatabaseMigratorToken,
        (resolver) =>
          new SqliteDatabaseMigrator({
            openDatabase: () => resolver.resolve(SqliteDatabaseToken),
            migrations: APP_MIGRATIONS,
          }),
      )
      // Startup tasks resolve their use cases only when they run, after a successful startup.
      .register(BootstrapperToken, (resolver) =>
        createBootstrapper({
          migrator: resolver.resolve(DatabaseMigratorToken),
          logger: resolver.resolve(LoggerToken),
          startupTasks: exercisesStartupTasks(resolver),
        }),
      )
      .register(InstalledAppInfoToken, (resolver) =>
        createExpoInstalledAppInfo(resolver.resolve(LoggerToken)),
      )
      // Self-update (Sprint 0.5, ADR-003). The check is a singleton: its memoized first promise
      // guarantees at most one GitHub request per launch, and it is inactive in Expo Go/dev bundles.
      .register(
        ReleaseSourceToken,
        () =>
          new GitHubReleaseSource({
            repository: GITHUB_RELEASE_REPOSITORY,
            timeoutMs: RELEASE_CHECK_TIMEOUT_MS,
            // Called as a plain function: some fetch implementations reject a foreign `this`.
            fetch: (url, options) => fetch(url, options),
          }),
      )
      .register(ApkDownloaderToken, () => new ExpoApkDownloader())
      .register(ApkInstallerToken, () => new IntentApkInstaller())
      .register(CheckForUpdateToken, (resolver) =>
        createCheckForUpdate({
          installedAppInfo: resolver.resolve(InstalledAppInfoToken),
          releaseSource: resolver.resolve(ReleaseSourceToken),
          logger: resolver.resolve(LoggerToken),
        }),
      )
      .register(DownloadUpdateToken, (resolver) =>
        createDownloadUpdate({
          downloader: resolver.resolve(ApkDownloaderToken),
          logger: resolver.resolve(LoggerToken),
        }),
      )
      .register(InstallUpdateToken, (resolver) =>
        createInstallUpdate({
          installer: resolver.resolve(ApkInstallerToken),
          logger: resolver.resolve(LoggerToken),
        }),
      )
      // Singleton per container = per JS process: a dismissed offer survives a remount of the
      // prompt, but not the next launch (QA-05-1; not persisted on purpose).
      .register(UpdateOfferDismissalToken, () => createUpdateOfferDismissal())
  );
}
