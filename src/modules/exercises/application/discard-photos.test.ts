import { aCustomExercise, aCustomPhoto } from '@test/builders/exercise.builder';
import { FakePhotoStore } from '@test/fakes/fake-photo-store';
import { InMemoryExerciseStore } from '@test/fakes/in-memory-exercise-store';
import { RecordingLogger } from '@test/fakes/recording-logger';

import { createDiscardPhotos } from './discard-photos';

const fileNames = (...names: readonly string[]) => names.map((name) => aCustomPhoto(name).fileName);
const saved = aCustomExercise().withPhotos('saved.jpg').build();

function setUp() {
  const store = new InMemoryExerciseStore({ exercises: [saved] });
  const photoStore = new FakePhotoStore(fileNames('saved.jpg', 'new-1.jpg', 'new-2.jpg'));
  const logger = new RecordingLogger();
  const discardPhotos = createDiscardPhotos({ reader: store, photoStore, logger });
  return { store, photoStore, logger, discardPhotos };
}

describe('createDiscardPhotos (S1-19, S1-22)', () => {
  it('deletes the photos a discarded form imported', async () => {
    const { discardPhotos, photoStore } = setUp();

    await discardPhotos(fileNames('new-1.jpg', 'new-2.jpg'));

    expect(photoStore.deleted).toEqual(fileNames('new-1.jpg', 'new-2.jpg'));
  });

  it('never deletes a photo an active exercise refers to', async () => {
    const { discardPhotos, photoStore } = setUp();

    await discardPhotos(fileNames('saved.jpg', 'new-1.jpg'));

    expect(photoStore.deleted).toEqual(fileNames('new-1.jpg'));
  });

  it('does nothing for an empty list', async () => {
    const { discardPhotos, photoStore, store } = setUp();
    store.failWith('not even read');

    await discardPhotos([]);

    expect(photoStore.deleted).toEqual([]);
  });

  it('deletes nothing and logs when the referenced photos cannot be read', async () => {
    const { discardPhotos, photoStore, store, logger } = setUp();
    store.failWith('disk');

    await discardPhotos(fileNames('new-1.jpg'));

    expect(photoStore.deleted).toEqual([]);
    expect(logger.entriesAt('warn')).toHaveLength(1);
  });

  it('resolves and logs when deleting fails', async () => {
    const { discardPhotos, photoStore, logger } = setUp();
    photoStore.failStorage();

    await expect(discardPhotos(fileNames('new-1.jpg'))).resolves.toBeUndefined();
    expect(logger.entriesAt('warn')).toHaveLength(1);
  });
});
