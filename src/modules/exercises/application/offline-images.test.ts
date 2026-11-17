import { domainError } from '@shared/domain/domain-error';
import { aBuiltInExercise, aBuiltInImage } from '@test/builders/exercise.builder';
import {
  CONTRACT_IMAGE_SIZE_BYTES,
  describeOfflineImagesContract,
  stateReached,
} from '@test/contracts/offline-images.contract';
import { FakeBuiltInImageCache } from '@test/fakes/fake-built-in-image-cache';
import { InMemoryExerciseStore } from '@test/fakes/in-memory-exercise-store';
import { RecordingLogger } from '@test/fakes/recording-logger';
import { failedSeeding, seededLibrary } from '@test/fakes/stub-ensure-library-seeded';
import { unwrapErr } from '@test/support/unwrap';

import type { BuiltInImage } from '../domain/exercise';

import type { BuiltInImageCache } from './built-in-image-cache';
import type { EnsureLibrarySeeded } from './ensure-library-seeded';
import {
  CONSECUTIVE_FAILURES_TO_STOP,
  createOfflineImages,
  OFFLINE_IMAGES_CONCURRENCY,
  type OfflineImagesState,
} from './offline-images';

const imagesNamed = (prefix: string, count: number): readonly BuiltInImage[] =>
  Array.from({ length: count }, (_unused, index) =>
    aBuiltInImage(`${prefix}_${index}/0.jpg`, CONTRACT_IMAGE_SIZE_BYTES),
  );

/** A library whose active built-ins have these images, one per exercise, plus an archived one. */
function libraryWith(images: readonly BuiltInImage[]): InMemoryExerciseStore {
  const exercises = images.map((image, index) =>
    aBuiltInExercise()
      .named(`Exercise ${index}`)
      .with({ images: [image] })
      .build(),
  );
  const archived = aBuiltInExercise()
    .named('Archived')
    .with({ images: imagesNamed('Archived', 1) })
    .archived()
    .build();
  return new InMemoryExerciseStore({ exercises: [...exercises, archived] });
}

interface Arranged {
  readonly cached?: readonly BuiltInImage[];
  readonly missing: readonly BuiltInImage[];
  readonly ensureLibrarySeeded?: EnsureLibrarySeeded;
}

function setUp({ cached = [], missing, ensureLibrarySeeded = seededLibrary() }: Arranged) {
  const store = libraryWith([...cached, ...missing]);
  const imageCache = new FakeBuiltInImageCache(cached.map(({ path }) => path));
  const logger = new RecordingLogger();
  const service = createOfflineImages({ ensureLibrarySeeded, catalog: store, imageCache, logger });
  return { store, imageCache, logger, service };
}

describeOfflineImagesContract('createOfflineImages on fakes', () => {
  let current = setUp({ missing: [] });
  const imageCache: BuiltInImageCache = {
    localUri: (path) => current.imageCache.localUri(path),
    cachedPaths: () => current.imageCache.cachedPaths(),
    download: (path) => current.imageCache.download(path),
  };
  const service = createOfflineImages({
    ensureLibrarySeeded: seededLibrary(),
    catalog: { listActiveBuiltInImages: () => current.store.listActiveBuiltInImages() },
    imageCache,
    logger: new RecordingLogger(),
  });
  return {
    service,
    givenImages: ({ cached, missing, failing = 0 }) => {
      current = setUp({
        cached: imagesNamed('Cached', cached),
        missing: imagesNamed('Missing', missing),
      });
      current.imageCache.failPaths(imagesNamed('Missing', failing).map(({ path }) => path));
    },
    holdDownloads: () => current.imageCache.holdDownloads(),
    releaseDownloads: () => current.imageCache.releaseDownloads(),
  };
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createOfflineImages (S1-28)', () => {
  it('uses the agreed limits', () => {
    expect(OFFLINE_IMAGES_CONCURRENCY).toBe(4);
    expect(CONSECUTIVE_FAILURES_TO_STOP).toBe(5);
  });

  it('downloads at most four images at a time', async () => {
    const { service, imageCache } = setUp({ missing: imagesNamed('Missing', 10) });
    imageCache.holdDownloads();

    service.start();
    await stateReached(service, 'running');
    await flush();

    expect(imageCache.inFlight).toBe(OFFLINE_IMAGES_CONCURRENCY);
    imageCache.releaseDownloads();
    expect(await stateReached(service, 'finished')).toMatchObject({ succeeded: 10 });
  });

  it('ignores archived built-ins', async () => {
    const { service } = setUp({ missing: imagesNamed('Missing', 2) });

    expect(await service.estimate()).toMatchObject({ value: { totalCount: 2, missingCount: 2 } });
  });

  it('ends early after five failures in a row, counting what was not attempted as failed', async () => {
    const missing = imagesNamed('Missing', 20);
    const { service, imageCache, logger } = setUp({ missing });
    imageCache.failDownloads();

    service.start();
    const finished = await stateReached(service, 'finished');

    expect(finished).toEqual({ status: 'finished', succeeded: 0, failed: 20, stoppedEarly: true });
    expect(imageCache.requests.length).toBeLessThan(
      CONSECUTIVE_FAILURES_TO_STOP + OFFLINE_IMAGES_CONCURRENCY,
    );
    expect(logger.entriesAt('warn').length).toBeGreaterThanOrEqual(CONSECUTIVE_FAILURES_TO_STOP);
    expect(logger.entriesAt('warn')[0]?.context).toMatchObject({
      code: 'exercises.imageDownloadFailed',
    });
  });

  it('keeps going when failures are not consecutive', async () => {
    const missing = imagesNamed('Missing', 12);
    const { service, imageCache } = setUp({ missing });
    imageCache.failPaths(
      missing.filter((_image, index) => index % 2 === 0).map(({ path }) => path),
    );

    service.start();

    expect(await stateReached(service, 'finished')).toEqual({
      status: 'finished',
      succeeded: 6,
      failed: 6,
      stoppedEarly: false,
    });
  });

  it('cancels in-flight downloads, and later results do not change the cancelled state', async () => {
    const { service, imageCache } = setUp({ missing: imagesNamed('Missing', 6) });
    imageCache.holdDownloads();
    service.start();
    await stateReached(service, 'running');
    await flush();

    service.cancel();
    imageCache.releaseDownloads();
    await flush();

    expect(imageCache.inFlight).toBe(0);
    expect(service.getState()).toEqual({ status: 'cancelled', succeeded: 0, remaining: 6 });
  });

  it('ignores cancel after the run finished', async () => {
    const { service } = setUp({ missing: imagesNamed('Missing', 1) });
    service.start();
    const finished = await stateReached(service, 'finished');

    service.cancel();

    expect(service.getState()).toBe(finished);
  });

  it('honours a cancel while preparing: nothing is downloaded', async () => {
    const { service, imageCache } = setUp({ missing: imagesNamed('Missing', 3) });

    service.start();
    service.cancel();
    const cancelled = await stateReached(service, 'cancelled');
    await flush();

    expect(cancelled).toEqual({ status: 'cancelled', succeeded: 0, remaining: 3 });
    expect(imageCache.requests).toEqual([]);
  });

  it('can start again after a cancelled run and fetches only what is missing', async () => {
    const { service, imageCache } = setUp({ missing: imagesNamed('Missing', 3) });
    service.start();
    service.cancel();
    await stateReached(service, 'cancelled');

    service.start();

    expect(await stateReached(service, 'finished')).toMatchObject({ succeeded: 3 });
    expect(imageCache.requests).toHaveLength(3);
  });

  it('finishes with nothing done and logs an error when seeding failed', async () => {
    const failure = domainError('exercises.seedFailed', 'Seeding failed.');
    const { service, logger } = setUp({
      missing: imagesNamed('Missing', 2),
      ensureLibrarySeeded: failedSeeding(failure),
    });

    service.start();

    expect(await stateReached(service, 'finished')).toEqual({
      status: 'finished',
      succeeded: 0,
      failed: 0,
      stoppedEarly: false,
    });
    expect(logger.entriesAt('error')).toEqual([
      expect.objectContaining({
        context: expect.objectContaining({ code: 'exercises.seedFailed' }),
      }),
    ]);
  });

  it('returns a seeding failure from estimate', async () => {
    const failure = domainError('exercises.seedFailed', 'Seeding failed.');
    const { service } = setUp({ missing: [], ensureLibrarySeeded: failedSeeding(failure) });

    expect(unwrapErr(await service.estimate())).toBe(failure);
  });

  it('returns and logs a catalogue failure from estimate', async () => {
    const { service, store, logger } = setUp({ missing: imagesNamed('Missing', 1) });
    store.failWith('disk');

    expect(unwrapErr(await service.estimate()).code).toBe('exercises.storageFailed');
    expect(logger.entriesAt('warn')).toHaveLength(1);
  });

  it('notifies every listener of each new state', async () => {
    const { service } = setUp({ missing: imagesNamed('Missing', 1) });
    const first: OfflineImagesState[] = [];
    const second: OfflineImagesState[] = [];
    service.subscribe((state) => first.push(state));
    service.subscribe((state) => second.push(state));

    service.start();
    await stateReached(service, 'finished');

    expect(first).toEqual(second);
    expect(first.at(-1)).toMatchObject({ status: 'finished' });
  });
});
