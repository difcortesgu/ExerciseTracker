import { File } from 'expo-file-system';
import { startActivityAsync } from 'expo-intent-launcher';

import { describeCause } from '@shared/domain/describe-cause';
import { domainError } from '@shared/domain/domain-error';
import { err, ok, type Result } from '@shared/domain/result';

import type { DownloadedApk } from '../application/apk-downloader';
import type { ApkInstaller, InstallerError } from '../application/apk-installer';

/** `Intent.ACTION_VIEW` on an APK opens Android's system package installer. */
export const INSTALL_ACTION = 'android.intent.action.VIEW';
export const APK_MIME_TYPE = 'application/vnd.android.package-archive';
/** `Intent.FLAG_GRANT_READ_URI_PERMISSION`: lets the installer read our private file. */
export const FLAG_GRANT_READ_URI_PERMISSION = 1;

/**
 * Adapter (ports & adapters): the `ApkInstaller` port over `expo-intent-launcher`. Hands the APK to
 * Android's **system** installer through expo-file-system's content URI (FileProvider); Android
 * asks the user to confirm (and, once, to allow "Install unknown apps"). Resolves when the user is
 * back; never rejects.
 */
export class IntentApkInstaller implements ApkInstaller {
  async openInstaller(apk: DownloadedApk): Promise<Result<void, InstallerError>> {
    try {
      const file = new File(apk.fileUri);
      if (!file.exists) {
        return err(
          domainError('updates.apkMissing', 'The downloaded update no longer exists.', {
            fileUri: apk.fileUri,
          }),
        );
      }
      await startActivityAsync(INSTALL_ACTION, {
        data: file.contentUri,
        type: APK_MIME_TYPE,
        flags: FLAG_GRANT_READ_URI_PERMISSION,
      });
      return ok(undefined);
    } catch (cause) {
      return err(
        domainError('updates.installerUnavailable', "Android's installer could not be opened.", {
          cause: describeCause(cause),
        }),
      );
    }
  }
}
