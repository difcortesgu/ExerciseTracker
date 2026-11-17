import { aBuiltInImage } from '@test/builders/exercise.builder';
import { FakeBuiltInImageCache } from '@test/fakes/fake-built-in-image-cache';
import { unwrap, unwrapErr } from '@test/support/unwrap';

import { SingleFlightImageCache } from './single-flight-image-cache';

const squat = aBuiltInImage('Barbell_Squat/0.jpg').path;
const plank = aBuiltInImage('Plank/0.jpg').path;

function setUp(cached: readonly (typeof squat)[] = []) {
  const inner = new FakeBuiltInImageCache(cached);
  return { inner, cache: new SingleFlightImageCache(inner) };
}

describe('SingleFlightImageCache (Decorator, S1-18, S1-28)', () => {
  it('shares one download between concurrent callers of the same path', async () => {
    const { inner, cache } = setUp();
    inner.holdDownloads();

    const first = cache.download(squat);
    const second = cache.download(squat);
    inner.releaseDownloads();

    expect(unwrap(await first.result)).toBe(unwrap(await second.result));
    expect(inner.requests).toEqual([squat]);
  });

  it('downloads different paths separately', async () => {
    const { inner, cache } = setUp();

    await Promise.all([cache.download(squat).result, cache.download(plank).result]);

    expect(inner.requests).toEqual([squat, plank]);
  });

  it('starts a new download after the shared one failed', async () => {
    const { inner, cache } = setUp();
    inner.failDownloads();
    unwrapErr(await cache.download(squat).result);

    inner.restoreNetwork();
    const retried = await cache.download(squat).result;

    expect(retried.ok).toBe(true);
    expect(inner.requests).toEqual([squat, squat]);
  });

  it('cancels the shared download for every caller', async () => {
    const { inner, cache } = setUp();
    inner.holdDownloads();
    const onDemand = cache.download(squat);
    const bulk = cache.download(squat);

    bulk.cancel();

    expect(unwrapErr(await onDemand.result).code).toBe('exercises.imageDownloadCancelled');
    expect(unwrapErr(await bulk.result).code).toBe('exercises.imageDownloadCancelled');
  });

  it('delegates localUri and cachedPaths', async () => {
    const { cache } = setUp([squat]);

    expect(await cache.localUri(squat)).toBe('file:///cache/exercise-images/Barbell_Squat/0.jpg');
    expect(await cache.localUri(plank)).toBeNull();
    expect(await cache.cachedPaths()).toEqual(new Set([squat]));
  });
});
