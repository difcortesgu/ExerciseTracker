import type { DownloadedApk } from '@modules/updates/application/apk-downloader';
import type { ApkInstaller } from '@modules/updates/application/apk-installer';

import { defineContract } from './contract-harness';

/** An installer plus a way to arrange storage and Android's installer. */
export interface ApkInstallerFixture {
  readonly installer: ApkInstaller;
  /** A completed download whose file exists. */
  givenDownloadedApk(): DownloadedApk;
  /** A completed download whose file is gone (e.g. the cache was cleared). */
  givenMissingApk(): DownloadedApk;
  /** Android cannot open the package installer. */
  givenInstallerCannotOpen(): void;
  /** How many times Android's installer was opened. */
  installerOpenCount(): number;
}

/** Contract every `ApkInstaller` implementation must honour (Sprint 0.5, S05-10). */
export const describeApkInstallerContract = defineContract<ApkInstallerFixture>(
  'ApkInstaller',
  (fixture) => {
    it('opens the installer for a downloaded APK and resolves when the user is back', async () => {
      const apk = fixture().givenDownloadedApk();

      const result = await fixture().installer.openInstaller(apk);

      expect(result).toEqual({ ok: true, value: undefined });
      expect(fixture().installerOpenCount()).toBe(1);
    });

    it('reports a missing file as updates.apkMissing without opening the installer', async () => {
      const apk = fixture().givenMissingApk();

      const result = await fixture().installer.openInstaller(apk);

      expect(result).toMatchObject({ ok: false, error: { code: 'updates.apkMissing' } });
      expect(fixture().installerOpenCount()).toBe(0);
    });

    it('resolves (never rejects) with updates.installerUnavailable', async () => {
      const apk = fixture().givenDownloadedApk();
      fixture().givenInstallerCannotOpen();

      const result = await fixture().installer.openInstaller(apk);

      expect(result).toMatchObject({ ok: false, error: { code: 'updates.installerUnavailable' } });
    });
  },
);
