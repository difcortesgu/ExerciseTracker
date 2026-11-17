import type { BuiltInImageCache } from '@modules/exercises/application/built-in-image-cache';

import { aBuiltInImage } from '../../builders/exercise.builder';
import { defineContract } from '../contract-harness';

/** An image cache plus a way to arrange what the image server does. */
export interface BuiltInImageCacheFixture {
  readonly cache: BuiltInImageCache;
  /** Every request fails as when the phone is offline (or the server answers 404). */
  givenNetworkUnavailable(): void;
  /** Requests never complete on their own (to cancel them mid-way). */
  givenDownloadsHang(): void;
  /** How many requests reached the image server. */
  requestCount(): number;
}

const SQUAT = aBuiltInImage('Barbell_Squat/0.jpg').path;
const CURL = aBuiltInImage('Curl/1.jpg').path;

/** Contract of `BuiltInImageCache` (S1-18, S1-28). */
export const describeBuiltInImageCacheContract = defineContract<BuiltInImageCacheFixture>(
  'BuiltInImageCache',
  (fixture) => {
    it('has nothing cached at first', async () => {
      expect(await fixture().cache.localUri(SQUAT)).toBeNull();
      expect(await fixture().cache.cachedPaths()).toEqual(new Set());
    });

    it('downloads an image once and then serves it from the cache', async () => {
      const downloaded = await fixture().cache.download(SQUAT).result;

      expect(downloaded).toEqual({
        ok: true,
        value: expect.stringMatching(/^file:\/\//) as unknown,
      });
      expect(await fixture().cache.localUri(SQUAT)).toBe(downloaded.ok && downloaded.value);
      expect(await fixture().cache.cachedPaths()).toEqual(new Set([SQUAT]));
    });

    it('resolves an already cached image without a request', async () => {
      await fixture().cache.download(SQUAT).result;

      const again = await fixture().cache.download(SQUAT).result;

      expect(again.ok).toBe(true);
      expect(fixture().requestCount()).toBe(1);
    });

    it('lists every cached path', async () => {
      await fixture().cache.download(SQUAT).result;
      await fixture().cache.download(CURL).result;

      expect(await fixture().cache.cachedPaths()).toEqual(new Set([SQUAT, CURL]));
    });

    it('fails offline with exercises.imageDownloadFailed and leaves no file behind', async () => {
      fixture().givenNetworkUnavailable();

      const result = await fixture().cache.download(SQUAT).result;

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: 'exercises.imageDownloadFailed',
          details: { cause: expect.any(String) as unknown },
        },
      });
      expect(await fixture().cache.localUri(SQUAT)).toBeNull();
      expect(await fixture().cache.cachedPaths()).toEqual(new Set());
    });

    it('cancels a running download, leaving no file behind', async () => {
      fixture().givenDownloadsHang();
      const task = fixture().cache.download(SQUAT);

      task.cancel();
      task.cancel();

      expect(await task.result).toMatchObject({
        ok: false,
        error: { code: 'exercises.imageDownloadCancelled' },
      });
      expect(await fixture().cache.localUri(SQUAT)).toBeNull();
    });

    it('ignores a cancel after the download completed', async () => {
      const task = fixture().cache.download(SQUAT);
      const result = await task.result;

      task.cancel();

      expect(result.ok).toBe(true);
      expect(await fixture().cache.localUri(SQUAT)).not.toBeNull();
    });
  },
);
