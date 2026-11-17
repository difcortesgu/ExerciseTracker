import bundledManifest from '@assets/exercise-db/manifest.json';
import { BuiltInImageCacheToken } from '@modules/exercises/application/built-in-image-cache';
import { ExerciseDataCreditsToken } from '@modules/exercises/application/data-credits';
import {
  BuiltInImageCatalogToken,
  ExerciseReaderToken,
  ExerciseWriterToken,
  VocabularyReaderToken,
} from '@modules/exercises/application/exercise-repository';
import {
  BuiltInLibraryStoreToken,
  ExerciseSeedSourceToken,
} from '@modules/exercises/application/library-seed-ports';
import { PhotoPickerToken, PhotoStoreToken } from '@modules/exercises/application/photo-ports';
import { SingleFlightImageCache } from '@modules/exercises/application/single-flight-image-cache';
import { parseDatasetImagePath } from '@modules/exercises/domain/exercise';
import { AssetExerciseSeedSource } from '@modules/exercises/infrastructure/asset-exercise-seed-source';
import { ExpoPhotoPicker } from '@modules/exercises/infrastructure/expo-photo-picker';
import { ExpoPhotoStore } from '@modules/exercises/infrastructure/expo-photo-store';
import { SqliteBuiltInImageCatalog } from '@modules/exercises/infrastructure/sqlite-built-in-image-catalog';
import { SqliteBuiltInLibraryStore } from '@modules/exercises/infrastructure/sqlite-built-in-library-store';
import { SqliteExerciseReader } from '@modules/exercises/infrastructure/sqlite-exercise-reader';
import { SqliteExerciseWriter } from '@modules/exercises/infrastructure/sqlite-exercise-writer';
import { SqliteVocabularyReader } from '@modules/exercises/infrastructure/sqlite-vocabulary-reader';
import { IdGeneratorToken } from '@shared/application/id-generator';
import { SqliteDatabaseToken } from '@shared/infrastructure/db/sqlite-database';
import { SequentialIdGenerator } from '@test/fakes/sequential-id-generator';
import { memoryFileSystem } from '@test/support/in-memory-expo-file-system';
import { imageManipulator } from '@test/support/in-memory-image-manipulator';
import { createTestDatabase, type TestDatabase } from '@test/support/sqlite-test-database';
import { unwrap } from '@test/support/unwrap';

import { createContainer, type Container, type Resolver } from './container';
import { registerExerciseAdapters } from './exercise-adapter-registrations';

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

let testDatabase: TestDatabase;

/** The shared ports the adapters depend on, registered with fakes. */
function createAdaptersContainer(): Container {
  return registerExerciseAdapters(
    createContainer()
      .register(IdGeneratorToken, () => new SequentialIdGenerator('photo'))
      .register(SqliteDatabaseToken, () => testDatabase.database),
  );
}

beforeEach(() => {
  testDatabase = createTestDatabase();
  memoryFileSystem.reset();
  imageManipulator.reset();
});

afterEach(() => {
  testDatabase.close();
});

describe('registerExerciseAdapters', () => {
  it.each([
    ['ExerciseReader', (r: Resolver) => r.resolve(ExerciseReaderToken), SqliteExerciseReader],
    ['ExerciseWriter', (r: Resolver) => r.resolve(ExerciseWriterToken), SqliteExerciseWriter],
    ['VocabularyReader', (r: Resolver) => r.resolve(VocabularyReaderToken), SqliteVocabularyReader],
    [
      'BuiltInImageCatalog',
      (r: Resolver) => r.resolve(BuiltInImageCatalogToken),
      SqliteBuiltInImageCatalog,
    ],
    [
      'BuiltInLibraryStore',
      (r: Resolver) => r.resolve(BuiltInLibraryStoreToken),
      SqliteBuiltInLibraryStore,
    ],
    [
      'ExerciseSeedSource',
      (r: Resolver) => r.resolve(ExerciseSeedSourceToken),
      AssetExerciseSeedSource,
    ],
    [
      'BuiltInImageCache',
      (r: Resolver) => r.resolve(BuiltInImageCacheToken),
      SingleFlightImageCache,
    ],
    ['PhotoPicker', (r: Resolver) => r.resolve(PhotoPickerToken), ExpoPhotoPicker],
    ['PhotoStore', (r: Resolver) => r.resolve(PhotoStoreToken), ExpoPhotoStore],
  ] as const)('wires the %s port to its production adapter', (_port, resolvePort, adapter) => {
    expect(resolvePort(createAdaptersContainer())).toBeInstanceOf(adapter);
  });

  it('keeps one image cache per container', () => {
    const container = createAdaptersContainer();

    expect(container.resolve(BuiltInImageCacheToken)).toBe(
      container.resolve(BuiltInImageCacheToken),
    );
  });

  it('fetches concurrent requests for one image once, from the manifest image location', async () => {
    const cache = createAdaptersContainer().resolve(BuiltInImageCacheToken);

    const [first, second] = [cache.download(IMAGE_PATH), cache.download(IMAGE_PATH)];
    await Promise.all([first.result, second.result]);

    expect(memoryFileSystem.downloads.map(({ url }) => url)).toEqual([
      `${bundledManifest.imageBaseUrl}${IMAGE_PATH}`,
    ]);
  });

  it('names stored photos with the IdGenerator', async () => {
    const picked = 'file:///data/cache/ImagePicker/IMG_1.jpg';
    imageManipulator.givenImage(picked, { width: 800, height: 600 });

    const stored = await createAdaptersContainer()
      .resolve(PhotoStoreToken)
      .importPhoto({ uri: picked, width: 800, height: 600 });

    expect(unwrap(stored)).toBe('photo-1.jpg');
  });

  it('credits the dataset named in the bundled seed manifest', () => {
    expect(createAdaptersContainer().resolve(ExerciseDataCreditsToken)).toEqual({
      datasetName: 'free-exercise-db',
      repositoryUrl: 'https://github.com/yuhonas/free-exercise-db',
      licenceName: 'The Unlicense (public domain)',
      licenceUrl: 'https://unlicense.org/',
    });
  });
});
