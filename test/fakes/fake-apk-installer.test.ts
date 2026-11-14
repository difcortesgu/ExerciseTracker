import { describeApkInstallerContract } from '@test/contracts/apk-installer.contract';

import { FakeApkInstaller } from './fake-apk-installer';

describeApkInstallerContract('FakeApkInstaller', () => {
  const installer = new FakeApkInstaller();
  return {
    installer,
    givenDownloadedApk: () => installer.storeApk(),
    givenMissingApk: () => ({ fileUri: 'file:///gone.apk', sizeBytes: 10 }),
    givenInstallerCannotOpen: () => installer.makeUnavailable(),
    installerOpenCount: () => installer.openedFor.length,
  };
});

describe('FakeApkInstaller', () => {
  it('records which APKs it opened the installer for', async () => {
    const installer = new FakeApkInstaller();
    const apk = installer.storeApk({ fileUri: 'file:///a.apk', sizeBytes: 5 });

    await installer.openInstaller(apk);

    expect(installer.openedFor).toEqual([apk]);
  });
});
