import { File } from 'expo-file-system';

import manifest from '@assets/exercise-db/manifest.json';
import { aBuiltInImage } from '@test/builders/exercise.builder';
import { describeBuiltInImageCacheContract } from '@test/contracts/exercises/built-in-image-cache.contract';
import { memoryFileSystem } from '@test/support/in-memory-expo-file-system';

import { ExpoFileSystemImageCache } from './expo-file-system-image-cache';

// Native module boundary: expo-file-system needs the device's file system and network.
jest.mock('expo-file-system', () =>
  jest.requireActual<typeof import('@test/support/in-memory-expo-file-system')>(
    '@test/support/in-memory-expo-file-system',
  ),
);

const IMAGES_URI = 'file:///data/files/exercise-images';
const SQUAT = aBuiltInImage('Barbell_Squat/0.jpg').path;
const SQUAT_URI = `${IMAGES_URI}/Barbell_Squat/0.jpg`;
const SQUAT_PART_URI = `${SQUAT_URI}.part`;

const createCache = () => new ExpoFileSystemImageCache({ imageBaseUrl: manifest.imageBaseUrl });

function givenCachedFile(uri: string): void {
  new File(uri).parentDirectory.create({ intermediates: true, idempotent: true });
  memoryFileSystem.files.set(uri, 10);
}

beforeEach(() => {
  memoryFileSystem.reset();
});

describeBuiltInImageCacheContract('ExpoFileSystemImageCache', () => ({
  cache: createCache(),
  givenNetworkUnavailable: () => {
    memoryFileSystem.behaviour = {
      kind: 'fail',
      partialBytes: 100,
      cause: new Error('Network request failed'),
    };
  },
  givenDownloadsHang: () => {
    memoryFileSystem.behaviour = { kind: 'hang', partialBytes: 100 };
  },
  requestCount: () => memoryFileSystem.downloads.length,
}));

describe('ExpoFileSystemImageCache', () => {
  it('rejects a malformed image location at construction (broken build artefact)', () => {
    expect(() => new ExpoFileSystemImageCache({ imageBaseUrl: 'http://example.com' })).toThrow(
      'imageBaseUrl',
    );
  });

  it('streams the pinned image URL into a temporary file, then moves it into document storage', async () => {
    const result = await createCache().download(SQUAT).result;

    expect(result).toEqual({ ok: true, value: SQUAT_URI });
    expect(memoryFileSystem.downloads).toEqual([
      {
        url: `${manifest.imageBaseUrl}Barbell_Squat/0.jpg`,
        destinationUri: SQUAT_PART_URI,
        options: expect.objectContaining({
          idempotent: true,
          signal: expect.any(AbortSignal) as unknown,
        }) as unknown,
      },
    ]);
    expect([...memoryFileSystem.files.keys()]).toEqual([SQUAT_URI]);
  });

  it('overwrites a partial file left by an interrupted run', async () => {
    givenCachedFile(SQUAT_PART_URI);

    const result = await createCache().download(SQUAT).result;

    expect(result.ok).toBe(true);
    expect([...memoryFileSystem.files.keys()]).toEqual([SQUAT_URI]);
  });

  it('serves an image cached by an earlier app run (another instance)', async () => {
    givenCachedFile(SQUAT_URI);

    expect(await createCache().localUri(SQUAT)).toBe(SQUAT_URI);
  });

  it('lists only complete images, ignoring partial and foreign files', async () => {
    givenCachedFile(SQUAT_URI);
    givenCachedFile(`${IMAGES_URI}/Curl/1.jpg.part`);
    givenCachedFile(`${IMAGES_URI}/Not valid/0.jpg`);

    expect(await createCache().cachedPaths()).toEqual(new Set([SQUAT]));
  });

  it('counts nothing as cached when the folder cannot be listed', async () => {
    givenCachedFile(SQUAT_URI);
    memoryFileSystem.failingLists = true;

    expect(await createCache().cachedPaths()).toEqual(new Set());
  });

  it('downloads again after the image folder was cleared', async () => {
    const cache = createCache();
    await cache.download(SQUAT).result;
    memoryFileSystem.reset();

    const again = await cache.download(SQUAT).result;

    expect(again).toEqual({ ok: true, value: SQUAT_URI });
    expect(memoryFileSystem.downloads).toHaveLength(1);
  });

  it('fails without a visible file when the image cannot be moved into place', async () => {
    memoryFileSystem.failingMoves = true;

    const result = await createCache().download(SQUAT).result;

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'exercises.imageDownloadFailed', details: { cause: expect.any(String) } },
    });
    expect(memoryFileSystem.files.size).toBe(0);
  });

  it('reports a cleanup failure next to the cause', async () => {
    memoryFileSystem.behaviour = { kind: 'fail', partialBytes: 5, cause: new Error('HTTP 404') };
    memoryFileSystem.failingDeletes = true;

    const result = await createCache().download(SQUAT).result;

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'exercises.imageDownloadFailed',
        details: { cause: 'HTTP 404', cleanupFailure: expect.stringContaining('Cannot delete') },
      },
    });
  });

  it('is cancelled, discarding the file, when cancel comes after the bytes arrived but before it settled', async () => {
    const cache = createCache();
    let cancel: () => void = () => undefined;
    jest.spyOn(File, 'downloadFileAsync').mockImplementationOnce(async (_url, destination) => {
      await Promise.resolve();
      memoryFileSystem.files.set(destination.uri, 10);
      cancel();
      return new File(destination.uri);
    });

    const task = cache.download(SQUAT);
    cancel = () => task.cancel();

    expect(await task.result).toMatchObject({
      ok: false,
      error: { code: 'exercises.imageDownloadCancelled' },
    });
    expect(memoryFileSystem.files.size).toBe(0);
  });

  it('is cancelled before any request when cancelled right away', async () => {
    const task = createCache().download(SQUAT);

    task.cancel();

    expect(await task.result).toMatchObject({
      ok: false,
      error: { code: 'exercises.imageDownloadCancelled' },
    });
    expect(memoryFileSystem.files.size).toBe(0);
  });
});
