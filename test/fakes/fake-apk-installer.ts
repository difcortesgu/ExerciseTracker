import type { DownloadedApk } from '@modules/updates/application/apk-downloader';
import type { ApkInstaller, InstallerError } from '@modules/updates/application/apk-installer';
import { domainError } from '@shared/domain/domain-error';
import { err, ok, type Result } from '@shared/domain/result';

import { FAKE_APK_FILE_URI } from './fake-apk-downloader';

const DEFAULT_APK: DownloadedApk = Object.freeze({ fileUri: FAKE_APK_FILE_URI, sizeBytes: 4096 });

/**
 * Fake `ApkInstaller`: knows which APK files "exist", records every hand-off to the "system
 * installer" and resolves at once (as if the user came straight back).
 */
export class FakeApkInstaller implements ApkInstaller {
  private storedUris: ReadonlySet<string> = new Set();
  private opened: readonly DownloadedApk[] = [];
  private unavailable = false;

  get openedFor(): readonly DownloadedApk[] {
    return this.opened;
  }

  /** Test helper: makes the APK's file exist and returns it. */
  storeApk(apk: DownloadedApk = DEFAULT_APK): DownloadedApk {
    this.storedUris = new Set([...this.storedUris, apk.fileUri]);
    return apk;
  }

  makeUnavailable(): void {
    this.unavailable = true;
  }

  openInstaller(apk: DownloadedApk): Promise<Result<void, InstallerError>> {
    if (!this.storedUris.has(apk.fileUri)) {
      return Promise.resolve(err(domainError('updates.apkMissing', 'Fake: APK file missing.')));
    }
    if (this.unavailable) {
      return Promise.resolve(
        err(domainError('updates.installerUnavailable', 'Fake: installer unavailable.')),
      );
    }
    this.opened = [...this.opened, apk];
    return Promise.resolve(ok(undefined));
  }
}
