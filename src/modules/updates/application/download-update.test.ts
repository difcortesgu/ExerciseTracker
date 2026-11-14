import type { DownloadProgress } from '@modules/updates/application/apk-downloader';
import { aRelease } from '@test/builders/release.builder';
import { FakeApkDownloader } from '@test/fakes/fake-apk-downloader';
import { RecordingLogger } from '@test/fakes/recording-logger';

import { createDownloadUpdate } from './download-update';

function setUp() {
  const downloader = new FakeApkDownloader();
  const logger = new RecordingLogger();
  return { downloader, logger, downloadUpdate: createDownloadUpdate({ downloader, logger }) };
}

const release = aRelease().forBuild(43).withSize(2048).build();

describe('createDownloadUpdate', () => {
  it("downloads the release's APK, expecting its size", async () => {
    const { downloadUpdate, downloader } = setUp();

    const result = await downloadUpdate(release, () => undefined).result;

    expect(downloader.requests).toEqual([
      expect.objectContaining({ url: release.apk.downloadUrl, expectedSizeBytes: 2048 }),
    ]);
    expect(result).toMatchObject({ ok: true, value: { sizeBytes: 2048 } });
  });

  it('forwards progress as data arrives', async () => {
    const { downloadUpdate } = setUp();
    const progress: DownloadProgress[] = [];

    await downloadUpdate(release, (update) => progress.push(update)).result;

    expect(progress.at(-1)).toEqual({ receivedBytes: 2048, totalBytes: 2048 });
  });

  it('does not log a successful download as a problem', async () => {
    const { downloadUpdate, logger } = setUp();

    await downloadUpdate(release, () => undefined).result;

    expect(logger.entriesAt('warn')).toEqual([]);
    expect(logger.entriesAt('error')).toEqual([]);
  });

  it.each([
    ['a network failure', 'updates.downloadFailed', (d: FakeApkDownloader) => d.failDownloads()],
    ['a size mismatch', 'updates.downloadSizeMismatch', (d: FakeApkDownloader) => d.deliver(1)],
  ] as const)('returns and logs %s', async (_case, code, arrange) => {
    const { downloadUpdate, downloader, logger } = setUp();
    arrange(downloader);

    const result = await downloadUpdate(release, () => undefined).result;

    expect(result).toMatchObject({ ok: false, error: { code } });
    expect(logger.entriesAt('warn')).toEqual([
      expect.objectContaining({ context: expect.objectContaining({ code }) as unknown }),
    ]);
  });

  it('cancels the running download without logging it as a problem', async () => {
    const { downloadUpdate, downloader, logger } = setUp();
    downloader.holdDownloads();
    const task = downloadUpdate(release, () => undefined);

    task.cancel();

    expect(await task.result).toMatchObject({
      ok: false,
      error: { code: 'updates.downloadCancelled' },
    });
    expect(downloader.storedApkExists).toBe(false);
    expect(logger.entriesAt('warn')).toEqual([]);
    expect(logger.entriesAt('error')).toEqual([]);
  });

  it('starts a fresh download on every call (Retry)', async () => {
    const { downloadUpdate, downloader } = setUp();
    downloader.failDownloads();
    await downloadUpdate(release, () => undefined).result;

    downloader.deliver(2048);
    const retry = await downloadUpdate(release, () => undefined).result;

    expect(downloader.requests).toHaveLength(2);
    expect(retry.ok).toBe(true);
  });
});
