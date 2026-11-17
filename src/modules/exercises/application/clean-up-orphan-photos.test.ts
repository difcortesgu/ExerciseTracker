import { aCustomExercise, aCustomPhoto } from '@test/builders/exercise.builder';
import { FakePhotoStore } from '@test/fakes/fake-photo-store';
import { InMemoryExerciseStore } from '@test/fakes/in-memory-exercise-store';
import { RecordingLogger } from '@test/fakes/recording-logger';
import { unwrap, unwrapErr } from '@test/support/unwrap';

import { createCleanUpOrphanPhotos } from './clean-up-orphan-photos';
import type { ExerciseReader } from './exercise-repository';
import type { PhotoStore } from './photo-ports';

const fileNames = (...names: readonly string[]) => names.map((name) => aCustomPhoto(name).fileName);
const active = aCustomExercise().withPhotos('active.jpg').build();
const archived = aCustomExercise().withPhotos('archived.jpg').archived().build();

function setUp(
  photoStore = new FakePhotoStore(fileNames('active.jpg', 'archived.jpg', 'crash.jpg')),
) {
  const store = new InMemoryExerciseStore({ exercises: [active, archived] });
  const logger = new RecordingLogger();
  const cleanUp = createCleanUpOrphanPhotos({ reader: store, photoStore, logger });
  return { store, photoStore, logger, cleanUp };
}

describe('createCleanUpOrphanPhotos (S1-22)', () => {
  it('deletes files no active exercise refers to and returns how many', async () => {
    const { cleanUp, photoStore } = setUp();

    expect(unwrap(await cleanUp())).toBe(2);
    expect(photoStore.deleted).toEqual(fileNames('archived.jpg', 'crash.jpg'));
  });

  it('deletes nothing when every file is referenced', async () => {
    const { cleanUp, photoStore } = setUp(new FakePhotoStore(fileNames('active.jpg')));

    expect(unwrap(await cleanUp())).toBe(0);
    expect(photoStore.deleted).toEqual([]);
  });

  it('lists the files before reading the references, so a newer import is never deleted', async () => {
    const fake = new FakePhotoStore(fileNames('active.jpg'));
    const calls: string[] = [];
    const photoStore: PhotoStore = {
      importPhoto: (photo) => fake.importPhoto(photo),
      localUri: (fileName) => fake.localUri(fileName),
      deletePhotos: (names) => fake.deletePhotos(names),
      listPhotos: () => {
        calls.push('listPhotos');
        return fake.listPhotos();
      },
    };
    const store = new InMemoryExerciseStore({ exercises: [active] });
    const reader: ExerciseReader = {
      listActiveSummaries: () => store.listActiveSummaries(),
      findById: (id) => store.findById(id),
      findActiveByNameKey: (key) => store.findActiveByNameKey(key),
      listActivePhotoFileNames: async () => {
        calls.push('listActivePhotoFileNames');
        await fake.importPhoto({ uri: 'file:///picker/new.jpg', width: 1, height: 1 });
        return store.listActivePhotoFileNames();
      },
    };
    const cleanUp = createCleanUpOrphanPhotos({
      reader,
      photoStore,
      logger: new RecordingLogger(),
    });

    expect(unwrap(await cleanUp())).toBe(0);
    expect(calls).toEqual(['listPhotos', 'listActivePhotoFileNames']);
    expect(fake.deleted).toEqual([]);
  });

  it('returns and logs a listing failure', async () => {
    const photoStore = new FakePhotoStore();
    photoStore.failStorage();
    const { cleanUp, logger } = setUp(photoStore);

    expect(unwrapErr(await cleanUp()).code).toBe('exercises.photoStorageFailed');
    expect(logger.entriesAt('warn')).toHaveLength(1);
  });

  it('deletes nothing when the references cannot be read', async () => {
    const { cleanUp, store, photoStore } = setUp();
    store.failWith('disk');

    expect(unwrapErr(await cleanUp()).code).toBe('exercises.storageFailed');
    expect(photoStore.deleted).toEqual([]);
  });

  it('returns a deletion failure', async () => {
    const fake = new FakePhotoStore(fileNames('crash.jpg'));
    const photoStore: PhotoStore = {
      importPhoto: (photo) => fake.importPhoto(photo),
      localUri: (fileName) => fake.localUri(fileName),
      listPhotos: () => fake.listPhotos(),
      deletePhotos: (names) => {
        fake.failStorage();
        return fake.deletePhotos(names);
      },
    };
    const store = new InMemoryExerciseStore({ exercises: [active] });
    const cleanUp = createCleanUpOrphanPhotos({
      reader: store,
      photoStore,
      logger: new RecordingLogger(),
    });

    expect(unwrapErr(await cleanUp()).code).toBe('exercises.photoStorageFailed');
  });
});
