import { startActivityAsync } from 'expo-intent-launcher';

import { describeApkInstallerContract } from '@test/contracts/apk-installer.contract';
import { memoryFileSystem } from '@test/support/in-memory-expo-file-system';

import {
  APK_MIME_TYPE,
  FLAG_GRANT_READ_URI_PERMISSION,
  INSTALL_ACTION,
  IntentApkInstaller,
} from './intent-apk-installer';

// Native module boundaries: the file system and Android's activity launcher.
jest.mock('expo-file-system', () =>
  jest.requireActual<typeof import('@test/support/in-memory-expo-file-system')>(
    '@test/support/in-memory-expo-file-system',
  ),
);
jest.mock('expo-intent-launcher', () => ({ startActivityAsync: jest.fn() }));

const startActivity = jest.mocked(startActivityAsync);
const APK = Object.freeze({ fileUri: 'file:///data/cache/updates/update.apk', sizeBytes: 2048 });

beforeEach(() => {
  memoryFileSystem.reset();
  startActivity.mockReset();
  startActivity.mockResolvedValue({ resultCode: 0 });
});

describeApkInstallerContract('IntentApkInstaller', () => ({
  installer: new IntentApkInstaller(),
  givenDownloadedApk: () => {
    memoryFileSystem.files.set(APK.fileUri, APK.sizeBytes);
    return APK;
  },
  givenMissingApk: () => APK,
  givenInstallerCannotOpen: () => {
    startActivity.mockRejectedValue(new Error('No Activity found to handle Intent'));
  },
  installerOpenCount: () => startActivity.mock.calls.length,
}));

describe('IntentApkInstaller', () => {
  it("opens Android's package installer for the APK's content URI with read permission", async () => {
    memoryFileSystem.files.set(APK.fileUri, APK.sizeBytes);

    await new IntentApkInstaller().openInstaller(APK);

    expect(startActivity).toHaveBeenCalledWith('android.intent.action.VIEW', {
      data: 'content://com.farid.exercisetracker.FileSystemFileProvider/data/cache/updates/update.apk',
      type: 'application/vnd.android.package-archive',
      flags: 1,
    });
    expect([INSTALL_ACTION, APK_MIME_TYPE, FLAG_GRANT_READ_URI_PERMISSION]).toEqual([
      'android.intent.action.VIEW',
      'application/vnd.android.package-archive',
      1,
    ]);
  });

  it('resolves ok when the user cancels the installer and comes back', async () => {
    memoryFileSystem.files.set(APK.fileUri, APK.sizeBytes);
    startActivity.mockResolvedValue({ resultCode: 0 });

    expect(await new IntentApkInstaller().openInstaller(APK)).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it('names the missing file and the cause of an installer failure', async () => {
    const missing = await new IntentApkInstaller().openInstaller(APK);
    memoryFileSystem.files.set(APK.fileUri, APK.sizeBytes);
    startActivity.mockRejectedValue(new Error('No Activity found'));
    const unavailable = await new IntentApkInstaller().openInstaller(APK);

    expect(missing).toMatchObject({ error: { details: { fileUri: APK.fileUri } } });
    expect(unavailable).toMatchObject({ error: { details: { cause: 'No Activity found' } } });
  });
});
