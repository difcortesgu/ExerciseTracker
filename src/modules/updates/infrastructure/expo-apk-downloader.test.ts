import type { DownloadProgress } from '@modules/updates/application/apk-downloader';
import { aRelease } from '@test/builders/release.builder';
import { describeApkDownloaderContract } from '@test/contracts/apk-downloader.contract';
import { memoryFileSystem } from '@test/support/in-memory-expo-file-system';

import {
  ExpoApkDownloader,
  UPDATE_APK_FILE_NAME,
  UPDATES_CACHE_DIRECTORY,
} from './expo-apk-downloader';

// Native module boundary: expo-file-system needs the device's file system and network.
jest.mock('expo-file-system', () =>
  jest.requireActual<typeof import('@test/support/in-memory-expo-file-system')>(
    '@test/support/in-memory-expo-file-system',
  ),
);

const APK_URI = 'file:///data/cache/updates/update.apk';
const SIZE = 2048;
const { apk } = aRelease().withSize(SIZE).build();

function start(progress: DownloadProgress[] = []) {
  return new ExpoApkDownloader().start({
    url: apk.downloadUrl,
    expectedSizeBytes: SIZE,
    onProgress: (update) => progress.push(update),
  });
}

beforeEach(() => {
  memoryFileSystem.reset();
});

describeApkDownloaderContract('ExpoApkDownloader', () => ({
  downloader: new ExpoApkDownloader(),
  givenServerDelivers: (sizeBytes) => {
    memoryFileSystem.behaviour = { kind: 'deliver', sizeBytes, serverTotalBytes: sizeBytes };
  },
  givenNetworkFailure: () => {
    memoryFileSystem.behaviour = { kind: 'fail', partialBytes: 100, cause: new Error('reset') };
  },
  givenDownloadHangs: () => {
    memoryFileSystem.behaviour = { kind: 'hang', partialBytes: 100 };
  },
  givenStaleApk: () => {
    memoryFileSystem.files.set(APK_URI, 999);
  },
  storedApkExists: () => memoryFileSystem.files.has(APK_URI),
}));

describe('ExpoApkDownloader', () => {
  it('downloads to one fixed file in the app cache', () => {
    expect([UPDATES_CACHE_DIRECTORY, UPDATE_APK_FILE_NAME]).toEqual(['updates', 'update.apk']);
  });

  it('streams the release URL into the fixed file, overwriting and abortable', async () => {
    memoryFileSystem.behaviour = { kind: 'deliver', sizeBytes: SIZE, serverTotalBytes: SIZE };

    const result = await start().result;

    expect(result).toEqual({ ok: true, value: { fileUri: APK_URI, sizeBytes: SIZE } });
    expect(memoryFileSystem.directories.has('file:///data/cache/updates')).toBe(true);
    expect(memoryFileSystem.downloads).toEqual([
      {
        url: apk.downloadUrl,
        destinationUri: APK_URI,
        options: expect.objectContaining({
          idempotent: true,
          signal: expect.any(AbortSignal) as unknown,
        }) as unknown,
      },
    ]);
  });

  it('reports the release size as the total when the server sends no length', async () => {
    memoryFileSystem.behaviour = { kind: 'deliver', sizeBytes: SIZE, serverTotalBytes: -1 };
    const progress: DownloadProgress[] = [];

    await start(progress).result;

    expect(progress).toEqual([
      { receivedBytes: SIZE / 2, totalBytes: SIZE },
      { receivedBytes: SIZE, totalBytes: SIZE },
    ]);
  });

  it('carries the cause of a failed download in the error details', async () => {
    memoryFileSystem.behaviour = {
      kind: 'fail',
      partialBytes: 10,
      cause: new Error('UnableToDownload: HTTP 500'),
    };

    const result = await start().result;

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'updates.downloadFailed', details: { cause: 'UnableToDownload: HTTP 500' } },
    });
  });

  it('reports the expected and actual sizes of a mismatched download', async () => {
    memoryFileSystem.behaviour = { kind: 'deliver', sizeBytes: 10, serverTotalBytes: 10 };

    const result = await start().result;

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'updates.downloadSizeMismatch',
        details: { expectedSizeBytes: SIZE, actualSizeBytes: 10 },
      },
    });
  });

  it('still resolves when the partial file cannot be deleted, naming the cleanup failure', async () => {
    memoryFileSystem.behaviour = { kind: 'fail', partialBytes: 10, cause: new Error('reset') };
    memoryFileSystem.failingDeletes = true;

    const result = await start().result;

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'updates.downloadFailed',
        details: { cause: 'reset', cleanupFailure: `Cannot delete ${APK_URI}.` },
      },
    });
  });

  it('fails without downloading when the stale APK cannot be removed first', async () => {
    memoryFileSystem.files.set(APK_URI, 5);
    memoryFileSystem.failingDeletes = true;

    const result = await start().result;

    expect(result).toMatchObject({ ok: false, error: { code: 'updates.downloadFailed' } });
    expect(memoryFileSystem.downloads).toEqual([]);
  });
});
