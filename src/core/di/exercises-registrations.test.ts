import { BuiltInImageCacheToken } from '@modules/exercises/application/built-in-image-cache';
import { CleanUpOrphanPhotosToken } from '@modules/exercises/application/clean-up-orphan-photos';
import { CreateCustomExerciseToken } from '@modules/exercises/application/create-custom-exercise';
import { DeleteCustomExerciseToken } from '@modules/exercises/application/delete-custom-exercise';
import { DiscardPhotosToken } from '@modules/exercises/application/discard-photos';
import { EnsureLibrarySeededToken } from '@modules/exercises/application/ensure-library-seeded';
import { FindExercisesToken } from '@modules/exercises/application/find-exercises';
import { GetExerciseDetailsToken } from '@modules/exercises/application/get-exercise-details';
import { GetExerciseFormValuesToken } from '@modules/exercises/application/get-exercise-form-values';
import { GetExerciseImageToken } from '@modules/exercises/application/get-exercise-image';
import { ImportPhotoToken } from '@modules/exercises/application/import-photo';
import { ListVocabularyOptionsToken } from '@modules/exercises/application/list-vocabulary-options';
import { OfflineImagesToken } from '@modules/exercises/application/offline-images';
import { PrepareDuplicateToken } from '@modules/exercises/application/prepare-duplicate';
import { ResolveVocabularyValueToken } from '@modules/exercises/application/resolve-vocabulary-value';
import { UpdateCustomExerciseToken } from '@modules/exercises/application/update-custom-exercise';
import { parseDatasetImagePath } from '@modules/exercises/domain/exercise';
import { IdGeneratorToken } from '@shared/application/id-generator';
import { LoggerToken } from '@shared/application/logger';
import { SqliteDatabaseToken } from '@shared/infrastructure/db/sqlite-database';
import { aBuiltInImage } from '@test/builders/exercise.builder';
import { RecordingLogger } from '@test/fakes/recording-logger';
import { SequentialIdGenerator } from '@test/fakes/sequential-id-generator';
import { EnsureLibrarySeededStub } from '@test/fakes/stub-ensure-library-seeded';
import { memoryFileSystem } from '@test/support/in-memory-expo-file-system';
import { imageManipulator } from '@test/support/in-memory-image-manipulator';
import { imagePicker } from '@test/support/in-memory-image-picker';
import { createTestDatabase, type TestDatabase } from '@test/support/sqlite-test-database';
import { unwrap } from '@test/support/unwrap';

import { createContainer, type Container, type Resolver } from './container';
import { exercisesStartupTasks, registerExercises } from './exercises-registrations';

// Native module boundaries (not available in Jest), replaced by the in-memory stand-ins.
jest.mock('expo-file-system', () =>
  jest.requireActual<typeof import('@test/support/in-memory-expo-file-system')>(
    '@test/support/in-memory-expo-file-system',
  ),
);
jest.mock('expo-image-picker', () =>
  jest.requireActual<typeof import('@test/support/in-memory-image-picker')>(
    '@test/support/in-memory-image-picker',
  ),
);
jest.mock('expo-image-manipulator', () =>
  jest.requireActual<typeof import('@test/support/in-memory-image-manipulator')>(
    '@test/support/in-memory-image-manipulator',
  ),
);

const IMAGE_PATH = unwrap(parseDatasetImagePath('Barbell_Squat/0.jpg'));

const flushBackgroundWork = () => new Promise((resolve) => setTimeout(resolve, 0));

let testDatabase: TestDatabase;

/** The shared ports the exercises wiring depends on, registered with fakes. */
function createExercisesContainer(): Container {
  return registerExercises(
    createContainer()
      .register(LoggerToken, () => new RecordingLogger())
      .register(IdGeneratorToken, () => new SequentialIdGenerator('photo'))
      .register(SqliteDatabaseToken, () => testDatabase.database),
  );
}

beforeEach(() => {
  testDatabase = createTestDatabase();
  memoryFileSystem.reset();
  imageManipulator.reset();
  imagePicker.reset();
});

afterEach(() => {
  testDatabase.close();
});

describe('registerExercises', () => {
  it.each([
    ['EnsureLibrarySeeded', (r: Resolver) => r.resolve(EnsureLibrarySeededToken)],
    ['FindExercises', (r: Resolver) => r.resolve(FindExercisesToken)],
    ['GetExerciseDetails', (r: Resolver) => r.resolve(GetExerciseDetailsToken)],
    ['GetExerciseFormValues', (r: Resolver) => r.resolve(GetExerciseFormValuesToken)],
    ['GetExerciseImage', (r: Resolver) => r.resolve(GetExerciseImageToken)],
    ['ListVocabularyOptions', (r: Resolver) => r.resolve(ListVocabularyOptionsToken)],
    ['ResolveVocabularyValue', (r: Resolver) => r.resolve(ResolveVocabularyValueToken)],
    ['CreateCustomExercise', (r: Resolver) => r.resolve(CreateCustomExerciseToken)],
    ['UpdateCustomExercise', (r: Resolver) => r.resolve(UpdateCustomExerciseToken)],
    ['DeleteCustomExercise', (r: Resolver) => r.resolve(DeleteCustomExerciseToken)],
    ['PrepareDuplicate', (r: Resolver) => r.resolve(PrepareDuplicateToken)],
    ['ImportPhoto', (r: Resolver) => r.resolve(ImportPhotoToken)],
    ['DiscardPhotos', (r: Resolver) => r.resolve(DiscardPhotosToken)],
    ['CleanUpOrphanPhotos', (r: Resolver) => r.resolve(CleanUpOrphanPhotosToken)],
  ] as const)('registers the %s use case', (_useCase, resolveUseCase) => {
    expect(resolveUseCase(createExercisesContainer())).toEqual(expect.any(Function));
  });

  it('seeds once per container: every use case shares the memoized EnsureLibrarySeeded', () => {
    const container = createExercisesContainer();

    expect(container.resolve(EnsureLibrarySeededToken)).toBe(
      container.resolve(EnsureLibrarySeededToken),
    );
  });

  it('lets on-demand images and the bulk download share one image cache', async () => {
    memoryFileSystem.behaviour = { kind: 'hang', partialBytes: 0 };
    const container = createExercisesContainer();
    const bulkDownload = container.resolve(BuiltInImageCacheToken).download(IMAGE_PATH);

    const shown = container.resolve(GetExerciseImageToken)(aBuiltInImage(IMAGE_PATH));
    await flushBackgroundWork();
    const requestsWhileInFlight = memoryFileSystem.downloads.length;
    bulkDownload.cancel();

    expect(requestsWhileInFlight).toBe(1);
    expect(await shown).toEqual({ status: 'unavailable' });
  });

  it('keeps one offline-images service per container, so a running download survives remounts', () => {
    const container = createExercisesContainer();

    expect(container.resolve(OfflineImagesToken)).toBe(container.resolve(OfflineImagesToken));
  });

  it('stores imported photos under a generated id', async () => {
    const picked = 'file:///data/cache/ImagePicker/IMG_1.jpg';
    imageManipulator.givenImage(picked, { width: 800, height: 600 });
    imagePicker.givenPicked({ uri: picked, width: 800, height: 600 });

    const imported = await createExercisesContainer().resolve(ImportPhotoToken)('library');

    expect(unwrap(imported)).toEqual({
      fileName: 'photo-1.jpg',
      uri: 'file:///data/files/exercise-photos/photo-1.jpg',
    });
  });
});

describe('exercisesStartupTasks', () => {
  it('seeds the library first, then removes orphan photos', () => {
    const tasks = exercisesStartupTasks(createExercisesContainer());

    expect(tasks.map(({ name }) => name)).toEqual([
      'exercises.EnsureLibrarySeeded',
      'exercises.CleanUpOrphanPhotos',
    ]);
  });

  it('resolves nothing until a task runs, so creating them opens no database', () => {
    const container = createExercisesContainer().register(SqliteDatabaseToken, () => {
      throw new Error('the database must not be opened yet');
    });

    expect(() => exercisesStartupTasks(container)).not.toThrow();
  });

  it('runs the registered use cases', async () => {
    const seeding = new EnsureLibrarySeededStub();
    const container = createExercisesContainer()
      .register(EnsureLibrarySeededToken, () => seeding.ensure)
      .register(CleanUpOrphanPhotosToken, () => () => Promise.resolve({ ok: true, value: 3 }));
    const [seed, cleanUp] = exercisesStartupTasks(container);

    expect(await seed?.run()).toEqual({ ok: true, value: { kind: 'upToDate', seedVersion: 1 } });
    expect(await cleanUp?.run()).toEqual({ ok: true, value: 3 });
    expect(seeding.calls).toBe(1);
  });
});
