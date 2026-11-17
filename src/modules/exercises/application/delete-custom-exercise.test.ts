import {
  aBuiltInExercise,
  aCustomExercise,
  aCustomPhoto,
  exerciseIdOf,
} from '@test/builders/exercise.builder';
import { FakePhotoStore } from '@test/fakes/fake-photo-store';
import { InMemoryExerciseStore } from '@test/fakes/in-memory-exercise-store';
import { RecordingLogger } from '@test/fakes/recording-logger';
import { unwrap, unwrapErr } from '@test/support/unwrap';

import { comparisonKey } from '../domain/comparison-key';

import { createDeleteCustomExercise } from './delete-custom-exercise';

const squat = aBuiltInExercise().build();
const goblet = aCustomExercise().named('My Goblet Squat').withPhotos('a.jpg', 'b.jpg').build();
const plain = aCustomExercise().named('Plain').build();
const archived = aCustomExercise().named('Old').archived().build();
const fileNames = (...names: readonly string[]) => names.map((name) => aCustomPhoto(name).fileName);

function setUp() {
  const store = new InMemoryExerciseStore({ exercises: [squat, goblet, plain, archived] });
  const photoStore = new FakePhotoStore(fileNames('a.jpg', 'b.jpg'));
  const logger = new RecordingLogger();
  const deleteCustomExercise = createDeleteCustomExercise({
    reader: store,
    writer: store,
    photoStore,
    logger,
  });
  return { store, photoStore, logger, deleteCustomExercise };
}

describe('createDeleteCustomExercise (S1-21)', () => {
  it('archives the exercise: hidden, still readable with includeArchived', async () => {
    const { deleteCustomExercise, store } = setUp();

    unwrap(await deleteCustomExercise(goblet.id));

    expect(unwrap(await store.findById(goblet.id))).toBeNull();
    expect(unwrap(await store.findById(goblet.id, { includeArchived: true }))).toMatchObject({
      name: 'My Goblet Squat',
      trackedMetrics: ['weight', 'reps'],
      archived: true,
    });
    expect(unwrap(await store.findActiveByNameKey(comparisonKey(goblet.name)))).toBeNull();
  });

  it('deletes its photo files right away', async () => {
    const { deleteCustomExercise, photoStore } = setUp();

    unwrap(await deleteCustomExercise(goblet.id));

    expect(photoStore.deleted).toEqual(fileNames('a.jpg', 'b.jpg'));
  });

  it('does not touch the photo store for an exercise without photos', async () => {
    const { deleteCustomExercise, photoStore } = setUp();
    photoStore.failStorage();

    expect((await deleteCustomExercise(plain.id)).ok).toBe(true);
    expect(photoStore.deleted).toEqual([]);
  });

  it('still succeeds and logs when deleting the photos fails', async () => {
    const { deleteCustomExercise, photoStore, logger, store } = setUp();
    photoStore.failStorage();

    expect((await deleteCustomExercise(goblet.id)).ok).toBe(true);
    expect(unwrap(await store.findById(goblet.id))).toBeNull();
    expect(logger.entriesAt('warn')).toHaveLength(1);
  });

  it('refuses a built-in with exercises.builtInReadOnly and changes nothing', async () => {
    const { deleteCustomExercise, store, logger } = setUp();

    expect(unwrapErr(await deleteCustomExercise(squat.id)).code).toBe('exercises.builtInReadOnly');
    expect(store.writeCount).toBe(0);
    expect(logger.entriesAt('warn')).toHaveLength(1);
  });

  it.each([
    ['unknown', exerciseIdOf('missing')],
    ['already archived', archived.id],
  ])('returns exercises.notFound for an %s id', async (_case, id) => {
    const { deleteCustomExercise } = setUp();

    expect(unwrapErr(await deleteCustomExercise(id)).code).toBe('exercises.notFound');
  });

  it('returns a failed save and deletes no photo', async () => {
    const store = new InMemoryExerciseStore({ exercises: [goblet] });
    const brokenWriter = new InMemoryExerciseStore();
    brokenWriter.failWith('disk full');
    const photoStore = new FakePhotoStore(fileNames('a.jpg', 'b.jpg'));
    const deleteCustomExercise = createDeleteCustomExercise({
      reader: store,
      writer: brokenWriter,
      photoStore,
      logger: new RecordingLogger(),
    });

    expect(unwrapErr(await deleteCustomExercise(goblet.id)).code).toBe('exercises.storageFailed');
    expect(photoStore.deleted).toEqual([]);
    expect(unwrap(await store.findById(goblet.id))).not.toBeNull();
  });

  it('returns a storage failure and deletes no photo', async () => {
    const { deleteCustomExercise, store, photoStore } = setUp();
    store.failWith('disk');

    expect(unwrapErr(await deleteCustomExercise(goblet.id)).code).toBe('exercises.storageFailed');
    expect(photoStore.deleted).toEqual([]);
  });
});
