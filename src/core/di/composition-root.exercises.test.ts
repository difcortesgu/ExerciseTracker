import bundledManifest from '@assets/exercise-db/manifest.json';
import { BootstrapperToken } from '@core/bootstrap/bootstrapper';
import { CreateCustomExerciseToken } from '@modules/exercises/application/create-custom-exercise';
import { ExerciseDataCreditsToken } from '@modules/exercises/application/data-credits';
import { DeleteCustomExerciseToken } from '@modules/exercises/application/delete-custom-exercise';
import { DiscardPhotosToken } from '@modules/exercises/application/discard-photos';
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
import { EMPTY_EXERCISE_QUERY } from '@modules/exercises/domain/exercise-query';
import { CheckForUpdateToken } from '@modules/updates/application/check-for-update';
import { DownloadUpdateToken } from '@modules/updates/application/download-update';
import { InstallUpdateToken } from '@modules/updates/application/install-update';
import { UpdateOfferDismissalToken } from '@modules/updates/application/update-offer-dismissal';
import { InstalledAppInfoToken } from '@shared/application/installed-app-info';
import { LoggerToken } from '@shared/application/logger';
import { SqliteDatabaseToken } from '@shared/infrastructure/db/sqlite-database';
import { RecordingLogger } from '@test/fakes/recording-logger';
import { memoryFileSystem } from '@test/support/in-memory-expo-file-system';
import { createTestDatabase, type TestDatabase } from '@test/support/sqlite-test-database';
import { unwrap } from '@test/support/unwrap';

import { createProductionContainer } from './composition-root';
import type { Container, Resolver } from './container';

// Native module boundaries (not available in Jest). The database itself is replaced per test by an
// in-memory SQLite database, so the real migrations, adapters and bundled seed run end to end.
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => {
    throw new Error('no native SQLite in Jest');
  }),
}));
// Distinct v4-shaped UUIDs: seeding gives every built-in exercise its own id.
jest.mock('expo-crypto', () => {
  let issued = 0;
  return {
    randomUUID: () => {
      issued += 1;
      return `9b2f6c1e-0d7a-4c3b-8e5f-${String(issued).padStart(12, '0')}`;
    },
  };
});
jest.mock('expo-file-system', () =>
  jest.requireActual<typeof import('@test/support/in-memory-expo-file-system')>(
    '@test/support/in-memory-expo-file-system',
  ),
);
jest.mock('expo-intent-launcher', () => ({ startActivityAsync: jest.fn() }));
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

const PHOTOS_URI = 'file:///data/files/exercise-photos';
const flushBackgroundWork = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createProductionContainer', () => {
  beforeEach(() => {
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('exercise library (Sprint 1)', () => {
    let testDatabase: TestDatabase;

    /** The production container over an in-memory SQLite database instead of the device file. */
    function createContainerOverTestDatabase(): Container {
      return createProductionContainer().register(SqliteDatabaseToken, () => testDatabase.database);
    }

    beforeEach(() => {
      testDatabase = createTestDatabase();
      memoryFileSystem.reset();
    });

    afterEach(() => {
      testDatabase.close();
    });

    // Every token a screen resolves through `useDependency`; a missing one crashes the app.
    it.each([
      ['Bootstrapper', (r: Resolver) => r.resolve(BootstrapperToken)],
      ['InstalledAppInfo', (r: Resolver) => r.resolve(InstalledAppInfoToken)],
      ['CheckForUpdate', (r: Resolver) => r.resolve(CheckForUpdateToken)],
      ['DownloadUpdate', (r: Resolver) => r.resolve(DownloadUpdateToken)],
      ['InstallUpdate', (r: Resolver) => r.resolve(InstallUpdateToken)],
      ['UpdateOfferDismissal', (r: Resolver) => r.resolve(UpdateOfferDismissalToken)],
      ['FindExercises', (r: Resolver) => r.resolve(FindExercisesToken)],
      ['ListVocabularyOptions', (r: Resolver) => r.resolve(ListVocabularyOptionsToken)],
      ['GetExerciseImage', (r: Resolver) => r.resolve(GetExerciseImageToken)],
      ['GetExerciseFormValues', (r: Resolver) => r.resolve(GetExerciseFormValuesToken)],
      ['PrepareDuplicate', (r: Resolver) => r.resolve(PrepareDuplicateToken)],
      ['CreateCustomExercise', (r: Resolver) => r.resolve(CreateCustomExerciseToken)],
      ['UpdateCustomExercise', (r: Resolver) => r.resolve(UpdateCustomExerciseToken)],
      ['GetExerciseDetails', (r: Resolver) => r.resolve(GetExerciseDetailsToken)],
      ['DeleteCustomExercise', (r: Resolver) => r.resolve(DeleteCustomExerciseToken)],
      ['ResolveVocabularyValue', (r: Resolver) => r.resolve(ResolveVocabularyValueToken)],
      ['ImportPhoto', (r: Resolver) => r.resolve(ImportPhotoToken)],
      ['DiscardPhotos', (r: Resolver) => r.resolve(DiscardPhotosToken)],
      ['OfflineImages', (r: Resolver) => r.resolve(OfflineImagesToken)],
      ['ExerciseDataCredits', (r: Resolver) => r.resolve(ExerciseDataCreditsToken)],
    ] as const)('registers %s, which a screen resolves', (_token, resolveToken) => {
      expect(resolveToken(createContainerOverTestDatabase())).toBeDefined();
    });

    it('seeds the bundled library in the background after startup', async () => {
      const logger = new RecordingLogger();
      const container = createContainerOverTestDatabase().register(LoggerToken, () => logger);

      unwrap(await container.resolve(BootstrapperToken)());
      await flushBackgroundWork();

      expect(logger.entriesAt('info')).toContainEqual({
        level: 'info',
        message: 'Exercise library ready',
        context: expect.objectContaining({ kind: 'applied', inserted: 876 }) as unknown,
      });
      const library = unwrap(await container.resolve(FindExercisesToken)(EMPTY_EXERCISE_QUERY));
      expect(library).toHaveLength(bundledManifest.counts.exercises);
    });

    it('removes orphan photos in the background after startup', async () => {
      memoryFileSystem.directories.add(PHOTOS_URI);
      memoryFileSystem.files.set(`${PHOTOS_URI}/orphan.jpg`, 1);
      const container = createContainerOverTestDatabase();

      unwrap(await container.resolve(BootstrapperToken)());
      await flushBackgroundWork();

      expect(memoryFileSystem.files.has(`${PHOTOS_URI}/orphan.jpg`)).toBe(false);
    });
  });
});
