import { createToken } from '@shared/application/di/token';
import type { Logger } from '@shared/application/logger';
import type { Result } from '@shared/domain/result';

import type { DownloadedApk } from './apk-downloader';
import type { ApkInstaller, InstallerError } from './apk-installer';

/**
 * Use case: opens Android's system installer for a downloaded APK (S05-10). Resolves when the user
 * is back in the app; failures are logged through the Logger port and returned, never thrown.
 */
export type InstallUpdate = (apk: DownloadedApk) => Promise<Result<void, InstallerError>>;

export const InstallUpdateToken = createToken<InstallUpdate>('updates.InstallUpdate');

export interface InstallUpdateDependencies {
  readonly installer: ApkInstaller;
  readonly logger: Logger;
}

export function createInstallUpdate(deps: InstallUpdateDependencies): InstallUpdate {
  return async (apk) => {
    const result = await deps.installer.openInstaller(apk);
    if (!result.ok) {
      deps.logger.warn('Opening the update installer failed.', {
        code: result.error.code,
        details: result.error.details,
      });
    }
    return result;
  };
}
