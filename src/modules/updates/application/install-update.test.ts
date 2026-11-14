import { FakeApkInstaller } from '@test/fakes/fake-apk-installer';
import { RecordingLogger } from '@test/fakes/recording-logger';

import { createInstallUpdate } from './install-update';

function setUp() {
  const installer = new FakeApkInstaller();
  const logger = new RecordingLogger();
  return { installer, logger, installUpdate: createInstallUpdate({ installer, logger }) };
}

describe('createInstallUpdate', () => {
  it("hands the downloaded APK to Android's installer", async () => {
    const { installUpdate, installer, logger } = setUp();
    const apk = installer.storeApk();

    const result = await installUpdate(apk);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(installer.openedFor).toEqual([apk]);
    expect(logger.entries).toEqual([]);
  });

  it('returns and logs a missing APK', async () => {
    const { installUpdate, logger } = setUp();

    const result = await installUpdate({ fileUri: 'file:///gone.apk', sizeBytes: 1 });

    expect(result).toMatchObject({ ok: false, error: { code: 'updates.apkMissing' } });
    expect(logger.entriesAt('warn')).toEqual([
      expect.objectContaining({
        context: expect.objectContaining({ code: 'updates.apkMissing' }) as unknown,
      }),
    ]);
  });

  it('returns and logs an installer that cannot be opened', async () => {
    const { installUpdate, installer, logger } = setUp();
    const apk = installer.storeApk();
    installer.makeUnavailable();

    const result = await installUpdate(apk);

    expect(result).toMatchObject({ ok: false, error: { code: 'updates.installerUnavailable' } });
    expect(logger.entriesAt('warn')).toHaveLength(1);
  });
});
