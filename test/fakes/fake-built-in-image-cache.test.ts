import { aBuiltInImage } from '@test/builders/exercise.builder';
import { describeBuiltInImageCacheContract } from '@test/contracts/exercises/built-in-image-cache.contract';

import { FakeBuiltInImageCache } from './fake-built-in-image-cache';

describeBuiltInImageCacheContract('FakeBuiltInImageCache', () => {
  const cache = new FakeBuiltInImageCache();
  return {
    cache,
    givenNetworkUnavailable: () => cache.failDownloads(),
    givenDownloadsHang: () => cache.holdDownloads(),
    requestCount: () => cache.requests.length,
  };
});

describe('FakeBuiltInImageCache', () => {
  const squat = aBuiltInImage('Barbell_Squat/0.jpg').path;
  const curl = aBuiltInImage('Curl/0.jpg').path;

  it('starts with arranged cached images', async () => {
    const cache = new FakeBuiltInImageCache([squat]);

    expect(await cache.localUri(squat)).toBe('file:///cache/exercise-images/Barbell_Squat/0.jpg');
  });

  it('completes held downloads when released', async () => {
    const cache = new FakeBuiltInImageCache();
    cache.holdDownloads();
    const task = cache.download(squat);

    cache.releaseDownloads();

    expect(await task.result).toMatchObject({ ok: true });
  });

  it('fails only the arranged paths', async () => {
    const cache = new FakeBuiltInImageCache();
    cache.failPaths([curl]);

    expect((await cache.download(squat).result).ok).toBe(true);
    expect((await cache.download(curl).result).ok).toBe(false);
    expect(cache.requests).toEqual([squat, curl]);
  });

  it('lets the network come back', async () => {
    const cache = new FakeBuiltInImageCache();
    cache.failDownloads();

    cache.restoreNetwork();

    expect((await cache.download(squat).result).ok).toBe(true);
  });

  it('counts the downloads still in flight', () => {
    const cache = new FakeBuiltInImageCache();
    cache.holdDownloads();

    cache.download(squat);
    cache.download(curl);

    expect(cache.inFlight).toBe(2);
  });
});
