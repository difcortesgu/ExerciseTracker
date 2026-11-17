import { domainError } from '@shared/domain/domain-error';
import {
  aBuiltInExercise,
  aCustomExercise,
  aCustomPhoto,
  builtInVocabularyValues,
  exerciseIdOf,
} from '@test/builders/exercise.builder';
import { anExerciseDraft } from '@test/builders/exercise-draft.builder';
import { FakePhotoStore } from '@test/fakes/fake-photo-store';
import { InMemoryExerciseStore } from '@test/fakes/in-memory-exercise-store';
import { RecordingLogger } from '@test/fakes/recording-logger';
import { failedSeeding, seededLibrary } from '@test/fakes/stub-ensure-library-seeded';
import { unwrap, unwrapErr } from '@test/support/unwrap';

import type { EnsureLibrarySeeded } from './ensure-library-seeded';
import { createUpdateCustomExercise } from './update-custom-exercise';

const squat = aBuiltInExercise().named('Barbell Squat').build();
const goblet = aCustomExercise().named('my goblet squat').withPhotos('a.jpg', 'b.jpg').build();
const lunge = aCustomExercise().named('Lunge').build();
const archived = aCustomExercise().named('Old').archived().build();
const fileNames = (...names: readonly string[]) => names.map((name) => aCustomPhoto(name).fileName);

function setUp(ensureLibrarySeeded: EnsureLibrarySeeded = seededLibrary()) {
  const store = new InMemoryExerciseStore({
    exercises: [squat, goblet, lunge, archived],
    vocabulary: builtInVocabularyValues(),
  });
  const photoStore = new FakePhotoStore(fileNames('a.jpg', 'b.jpg', 'c.jpg'));
  const logger = new RecordingLogger();
  const updateCustomExercise = createUpdateCustomExercise({
    ensureLibrarySeeded,
    reader: store,
    writer: store,
    vocabularyReader: store,
    photoStore,
    logger,
  });
  return { store, photoStore, logger, updateCustomExercise };
}

describe('createUpdateCustomExercise (S1-20, S1-22)', () => {
  it('saves valid changes under the same id', async () => {
    const { updateCustomExercise, store } = setUp();
    const draft = anExerciseDraft()
      .named('My Goblet Squat')
      .with({ trackedMetrics: ['reps'] })
      .withPhotos('a.jpg', 'b.jpg')
      .build();

    unwrap(await updateCustomExercise(goblet.id, draft));

    expect(unwrap(await store.findById(goblet.id))).toMatchObject({
      id: goblet.id,
      origin: 'custom',
      name: 'My Goblet Squat',
      trackedMetrics: ['reps'],
      archived: false,
    });
  });

  it('deletes the photos removed in the form after a successful save, and only those', async () => {
    const { updateCustomExercise, photoStore } = setUp();

    unwrap(
      await updateCustomExercise(goblet.id, anExerciseDraft().withPhotos('b.jpg', 'c.jpg').build()),
    );

    expect(photoStore.deleted).toEqual(fileNames('a.jpg'));
  });

  it('deletes nothing when no photo was removed', async () => {
    const { updateCustomExercise, photoStore } = setUp();

    unwrap(
      await updateCustomExercise(goblet.id, anExerciseDraft().withPhotos('a.jpg', 'b.jpg').build()),
    );

    expect(photoStore.deleted).toEqual([]);
  });

  it('keeps the save and logs when deleting removed photos fails', async () => {
    const { updateCustomExercise, photoStore, logger, store } = setUp();
    photoStore.failStorage();

    const result = await updateCustomExercise(
      goblet.id,
      anExerciseDraft().named('Renamed').build(),
    );

    expect(result.ok).toBe(true);
    expect(unwrap(await store.findById(goblet.id))?.name).toBe('Renamed');
    expect(logger.entriesAt('warn')).toEqual([
      expect.objectContaining({
        context: expect.objectContaining({ code: 'exercises.photoStorageFailed' }),
      }),
    ]);
  });

  it('rejects a name taken by another active exercise', async () => {
    const { updateCustomExercise, store } = setUp();

    const error = unwrapErr(
      await updateCustomExercise(goblet.id, anExerciseDraft().named('LUNGE').build()),
    );

    expect(error).toMatchObject({
      code: 'exercises.invalidExercise',
      issues: [{ code: 'exercises.duplicateName', details: { existingName: 'Lunge' } }],
    });
    expect(unwrap(await store.findById(goblet.id))?.name).toBe('my goblet squat');
  });

  it('refuses a built-in id with exercises.builtInReadOnly and changes nothing', async () => {
    const { updateCustomExercise, store } = setUp();

    const error = unwrapErr(await updateCustomExercise(squat.id, anExerciseDraft().build()));

    expect(error.code).toBe('exercises.builtInReadOnly');
    expect(store.writeCount).toBe(0);
  });

  it.each([
    ['unknown', exerciseIdOf('missing')],
    ['archived', archived.id],
  ])('returns exercises.notFound for an %s id', async (_case, id) => {
    const { updateCustomExercise } = setUp();

    expect(unwrapErr(await updateCustomExercise(id, anExerciseDraft().build())).code).toBe(
      'exercises.notFound',
    );
  });

  it('returns a seeding failure unchanged', async () => {
    const failure = domainError('exercises.seedFailed', 'Seeding failed.');
    const { updateCustomExercise } = setUp(failedSeeding(failure));

    expect(unwrapErr(await updateCustomExercise(goblet.id, anExerciseDraft().build()))).toBe(
      failure,
    );
  });

  it('returns a storage failure of the writer and deletes no photo', async () => {
    const store = new InMemoryExerciseStore({
      exercises: [goblet],
      vocabulary: builtInVocabularyValues(),
    });
    const broken = new InMemoryExerciseStore();
    broken.failWith('disk full');
    const photoStore = new FakePhotoStore(fileNames('a.jpg', 'b.jpg'));
    const updateCustomExercise = createUpdateCustomExercise({
      ensureLibrarySeeded: seededLibrary(),
      reader: store,
      writer: broken,
      vocabularyReader: store,
      photoStore,
      logger: new RecordingLogger(),
    });

    expect(unwrapErr(await updateCustomExercise(goblet.id, anExerciseDraft().build())).code).toBe(
      'exercises.storageFailed',
    );
    expect(photoStore.deleted).toEqual([]);
  });
});
