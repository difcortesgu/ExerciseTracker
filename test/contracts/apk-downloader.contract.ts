import type {
  ApkDownloader,
  DownloadProgress,
  DownloadRequest,
} from '@modules/updates/application/apk-downloader';

import { aRelease } from '../builders/release.builder';

import { defineContract } from './contract-harness';

/** A downloader plus a way to arrange the "server" and inspect app-private storage. */
export interface ApkDownloaderFixture {
  readonly downloader: ApkDownloader;
  /** The next downloads complete with a file of `sizeBytes` bytes. */
  givenServerDelivers(sizeBytes: number): void;
  /** The next downloads fail mid-way (connection lost after some bytes). */
  givenNetworkFailure(): void;
  /** The next downloads never complete on their own (only `cancel()` ends them). */
  givenDownloadHangs(): void;
  /** An APK from an earlier attempt or build is already in storage. */
  givenStaleApk(): void;
  /** Whether a downloaded APK file currently exists in storage. */
  storedApkExists(): boolean;
}

const EXPECTED_SIZE_BYTES = 4096;

function aRequest(): { request: DownloadRequest; progress: DownloadProgress[] } {
  const progress: DownloadProgress[] = [];
  const { apk } = aRelease().withSize(EXPECTED_SIZE_BYTES).build();
  return {
    progress,
    request: {
      url: apk.downloadUrl,
      expectedSizeBytes: EXPECTED_SIZE_BYTES,
      onProgress: (update) => progress.push(update),
    },
  };
}

/** Contract every `ApkDownloader` implementation must honour (Sprint 0.5, S05-09). */
export const describeApkDownloaderContract = defineContract<ApkDownloaderFixture>(
  'ApkDownloader',
  (fixture) => {
    it('completes with a size-verified APK in storage', async () => {
      fixture().givenServerDelivers(EXPECTED_SIZE_BYTES);

      const result = await fixture().downloader.start(aRequest().request).result;

      expect(result).toEqual({
        ok: true,
        value: { fileUri: expect.any(String) as unknown, sizeBytes: EXPECTED_SIZE_BYTES },
      });
      expect(fixture().storedApkExists()).toBe(true);
    });

    it('reports never-decreasing progress against the expected size', async () => {
      fixture().givenServerDelivers(EXPECTED_SIZE_BYTES);
      const { request, progress } = aRequest();

      await fixture().downloader.start(request).result;

      const received = progress.map((update) => update.receivedBytes);
      expect(progress.length).toBeGreaterThan(0);
      expect(received).toEqual([...received].sort((first, second) => first - second));
      expect(received.at(-1)).toBe(EXPECTED_SIZE_BYTES);
      expect(progress.every((update) => update.totalBytes === EXPECTED_SIZE_BYTES)).toBe(true);
    });

    it('replaces an APK from an earlier attempt instead of keeping both', async () => {
      fixture().givenStaleApk();
      fixture().givenServerDelivers(EXPECTED_SIZE_BYTES);

      const first = await fixture().downloader.start(aRequest().request).result;
      const second = await fixture().downloader.start(aRequest().request).result;

      expect(first.ok && second.ok && first.value.fileUri === second.value.fileUri).toBe(true);
      expect(fixture().storedApkExists()).toBe(true);
    });

    it('rejects a file whose size differs from the release and deletes it', async () => {
      fixture().givenServerDelivers(EXPECTED_SIZE_BYTES - 1);

      const result = await fixture().downloader.start(aRequest().request).result;

      expect(result).toMatchObject({ ok: false, error: { code: 'updates.downloadSizeMismatch' } });
      expect(fixture().storedApkExists()).toBe(false);
    });

    it('resolves (never rejects) with downloadFailed and deletes the partial file', async () => {
      fixture().givenStaleApk();
      fixture().givenNetworkFailure();

      const result = await fixture().downloader.start(aRequest().request).result;

      expect(result).toMatchObject({ ok: false, error: { code: 'updates.downloadFailed' } });
      expect(fixture().storedApkExists()).toBe(false);
    });

    it('stops on cancel, resolving with downloadCancelled and deleting the partial file', async () => {
      fixture().givenDownloadHangs();
      const task = fixture().downloader.start(aRequest().request);

      task.cancel();
      task.cancel();

      expect(await task.result).toMatchObject({
        ok: false,
        error: { code: 'updates.downloadCancelled' },
      });
      expect(fixture().storedApkExists()).toBe(false);
    });

    it('ignores a cancel after the download completed', async () => {
      fixture().givenServerDelivers(EXPECTED_SIZE_BYTES);
      const task = fixture().downloader.start(aRequest().request);
      await task.result;

      task.cancel();

      expect((await task.result).ok).toBe(true);
      expect(fixture().storedApkExists()).toBe(true);
    });
  },
);
