import { aBuiltInImage, aCustomPhoto } from '@test/builders/exercise.builder';
import { aPhotoView } from '@test/builders/exercise-dtos.builder';
import { FakeBuiltInImageCache } from '@test/fakes/fake-built-in-image-cache';
import { FakePhotoStore } from '@test/fakes/fake-photo-store';
import { RecordingLogger } from '@test/fakes/recording-logger';

import { createGetExerciseImage } from './get-exercise-image';

const image = aBuiltInImage('Barbell_Squat/0.jpg');
const photo = aCustomPhoto('mine.jpg');

function setUp(cached: readonly (typeof image)['path'][] = []) {
  const imageCache = new FakeBuiltInImageCache(cached);
  const photoStore = new FakePhotoStore([photo.fileName]);
  const logger = new RecordingLogger();
  const getExerciseImage = createGetExerciseImage({ imageCache, photoStore, logger });
  return { imageCache, logger, getExerciseImage };
}

describe('createGetExerciseImage (S1-18, S1-22)', () => {
  it('returns a stored custom photo', async () => {
    const { getExerciseImage } = setUp();

    expect(await getExerciseImage(photo)).toEqual({
      status: 'available',
      uri: aPhotoView('mine.jpg').uri,
    });
  });

  it('returns unavailable for a custom photo whose file is missing', async () => {
    const { getExerciseImage } = setUp();

    expect(await getExerciseImage(aCustomPhoto('gone.jpg'))).toEqual({ status: 'unavailable' });
  });

  it('returns a cached built-in image without downloading it', async () => {
    const { getExerciseImage, imageCache } = setUp([image.path]);

    expect(await getExerciseImage(image)).toEqual({
      status: 'available',
      uri: 'file:///cache/exercise-images/Barbell_Squat/0.jpg',
    });
    expect(imageCache.requests).toEqual([]);
  });

  it('downloads a built-in image that is not cached yet, once', async () => {
    const { getExerciseImage, imageCache } = setUp();

    expect(await getExerciseImage(image)).toMatchObject({ status: 'available' });
    expect(await getExerciseImage(image)).toMatchObject({ status: 'available' });
    expect(imageCache.requests).toEqual([image.path]);
  });

  it('returns unavailable offline, logs at info only, and retries on the next view', async () => {
    const { getExerciseImage, imageCache, logger } = setUp();
    imageCache.failDownloads();

    expect(await getExerciseImage(image)).toEqual({ status: 'unavailable' });
    imageCache.restoreNetwork();
    expect(await getExerciseImage(image)).toMatchObject({ status: 'available' });
    expect(logger.entriesAt('info')).toHaveLength(1);
    expect(logger.entriesAt('warn')).toHaveLength(0);
  });
});
