import { aRelease } from '@test/builders/release.builder';
import { describeApkDownloaderContract } from '@test/contracts/apk-downloader.contract';

import { FakeApkDownloader } from './fake-apk-downloader';

describeApkDownloaderContract('FakeApkDownloader', () => {
  const downloader = new FakeApkDownloader();
  return {
    downloader,
    givenServerDelivers: (sizeBytes) => downloader.deliver(sizeBytes),
    givenNetworkFailure: () => downloader.failDownloads(),
    givenDownloadHangs: () => downloader.holdDownloads(),
    givenStaleApk: () => downloader.storeStaleApk(),
    storedApkExists: () => downloader.storedApkExists,
  };
});

describe('FakeApkDownloader', () => {
  const { apk } = aRelease().withSize(100).build();
  const request = { url: apk.downloadUrl, expectedSizeBytes: 100, onProgress: () => undefined };

  it('delivers exactly the expected size by default', async () => {
    const result = await new FakeApkDownloader().start(request).result;

    expect(result).toMatchObject({ ok: true, value: { sizeBytes: 100 } });
  });

  it('records the requests it received', () => {
    const downloader = new FakeApkDownloader();

    downloader.start(request);

    expect(downloader.requests).toEqual([request]);
  });

  describe('stepping a held download by hand', () => {
    it('emits progress on request, then completes with the expected size', async () => {
      const downloader = new FakeApkDownloader();
      const progress: number[] = [];
      downloader.holdDownloads();
      const task = downloader.start({
        ...request,
        onProgress: ({ receivedBytes }) => progress.push(receivedBytes),
      });

      downloader.emitProgress(30);
      downloader.emitProgress(70);
      downloader.completeHeldDownload();

      expect(progress).toEqual([30, 70]);
      expect(await task.result).toMatchObject({ ok: true, value: { sizeBytes: 100 } });
      expect(downloader.storedApkExists).toBe(true);
    });

    it('fails a held download with the given error code', async () => {
      const downloader = new FakeApkDownloader();
      downloader.holdDownloads();
      const task = downloader.start(request);

      downloader.failHeldDownload('updates.downloadSizeMismatch');

      expect(await task.result).toMatchObject({
        ok: false,
        error: { code: 'updates.downloadSizeMismatch' },
      });
    });

    it('ignores steps when no download is held, or after it settled', async () => {
      const downloader = new FakeApkDownloader();
      const progress: number[] = [];
      downloader.emitProgress(10);
      downloader.completeHeldDownload();
      downloader.holdDownloads();
      const task = downloader.start({
        ...request,
        onProgress: ({ receivedBytes }) => progress.push(receivedBytes),
      });
      task.cancel();

      downloader.emitProgress(50);
      downloader.completeHeldDownload();

      expect(progress).toEqual([]);
      expect((await task.result).ok).toBe(false);
    });
  });
});
