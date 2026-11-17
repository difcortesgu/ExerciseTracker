import { domainError } from '@shared/domain/domain-error';
import {
  aBuiltInExercise,
  aCustomExercise,
  aCustomPhoto,
  aVocabularyValue,
  builtInVocabularyValues,
  exerciseIdOf,
} from '@test/builders/exercise.builder';
import { aPhotoView } from '@test/builders/exercise-dtos.builder';
import { FakePhotoStore } from '@test/fakes/fake-photo-store';
import { InMemoryExerciseStore } from '@test/fakes/in-memory-exercise-store';
import { RecordingLogger } from '@test/fakes/recording-logger';
import { failedSeeding, seededLibrary } from '@test/fakes/stub-ensure-library-seeded';
import { unwrap, unwrapErr } from '@test/support/unwrap';

import type { EnsureLibrarySeeded } from './ensure-library-seeded';
import { createGetExerciseFormValues } from './get-exercise-form-values';

const sandbag = aVocabularyValue().ofKind('equipment').labelled('Sandbag').custom().build();
const goblet = aCustomExercise()
  .named('My Goblet Squat')
  .with({ equipment: sandbag.key })
  .withPhotos('a.jpg', 'gone.jpg', 'b.jpg')
  .build();
const squat = aBuiltInExercise().build();
const archived = aCustomExercise().archived().build();

function setUp(ensureLibrarySeeded: EnsureLibrarySeeded = seededLibrary()) {
  const store = new InMemoryExerciseStore({
    exercises: [goblet, squat, archived],
    vocabulary: [...builtInVocabularyValues(), sandbag],
  });
  const photoStore = new FakePhotoStore(
    [aCustomPhoto('a.jpg'), aCustomPhoto('b.jpg')].map(({ fileName }) => fileName),
  );
  const logger = new RecordingLogger();
  const getExerciseFormValues = createGetExerciseFormValues({
    ensureLibrarySeeded,
    reader: store,
    vocabularyReader: store,
    photoStore,
    logger,
  });
  return { store, logger, getExerciseFormValues };
}

describe('createGetExerciseFormValues (S1-20)', () => {
  it('prefills every current value with labels, instructions by line and photo URIs', async () => {
    const { getExerciseFormValues } = setUp();

    const values = unwrap(await getExerciseFormValues(goblet.id));

    expect(values).toEqual({
      name: 'My Goblet Squat',
      category: { key: goblet.category, label: 'Strength', isCustom: false },
      primaryMuscles: [{ key: goblet.primaryMuscles[0], label: 'Quadriceps', isCustom: false }],
      secondaryMuscles: [{ key: goblet.secondaryMuscles[0], label: 'Glutes', isCustom: false }],
      equipment: { key: sandbag.key, label: 'Sandbag', isCustom: true },
      instructionsText: 'Hold the kettlebell at your chest.\nSquat down and stand up.',
      photos: [aPhotoView('a.jpg'), aPhotoView('b.jpg')],
      trackedMetrics: ['weight', 'reps'],
    });
  });

  it('leaves out a photo whose file is missing (it cannot be shown)', async () => {
    const { getExerciseFormValues } = setUp();

    const { photos } = unwrap(await getExerciseFormValues(goblet.id));

    expect(photos.map(({ fileName }) => fileName)).not.toContain('gone.jpg');
  });

  it('refuses a built-in with exercises.builtInReadOnly', async () => {
    const { getExerciseFormValues } = setUp();

    expect(unwrapErr(await getExerciseFormValues(squat.id)).code).toBe('exercises.builtInReadOnly');
  });

  it.each([
    ['unknown', exerciseIdOf('missing')],
    ['archived', archived.id],
  ])('returns exercises.notFound for an %s id', async (_case, id) => {
    const { getExerciseFormValues } = setUp();

    expect(unwrapErr(await getExerciseFormValues(id)).code).toBe('exercises.notFound');
  });

  it('returns a seeding failure unchanged', async () => {
    const failure = domainError('exercises.seedFailed', 'Seeding failed.');
    const { getExerciseFormValues } = setUp(failedSeeding(failure));

    expect(unwrapErr(await getExerciseFormValues(goblet.id))).toBe(failure);
  });

  it('returns and logs a storage failure', async () => {
    const { getExerciseFormValues, store, logger } = setUp();
    store.failWith('disk');

    expect(unwrapErr(await getExerciseFormValues(goblet.id)).code).toBe('exercises.storageFailed');
    expect(logger.entriesAt('warn')).toHaveLength(1);
  });

  it('returns a storage failure of the vocabulary reader', async () => {
    const failingVocabulary = new InMemoryExerciseStore();
    failingVocabulary.failWith('locked');
    const getExerciseFormValues = createGetExerciseFormValues({
      ensureLibrarySeeded: seededLibrary(),
      reader: new InMemoryExerciseStore({ exercises: [goblet] }),
      vocabularyReader: failingVocabulary,
      photoStore: new FakePhotoStore(),
      logger: new RecordingLogger(),
    });

    expect(unwrapErr(await getExerciseFormValues(goblet.id)).code).toBe('exercises.storageFailed');
  });
});
