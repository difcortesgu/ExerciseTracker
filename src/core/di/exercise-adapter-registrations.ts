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
import { createBundledExerciseSeedSource } from '@modules/exercises/infrastructure/asset-exercise-seed-source';
import { ExpoFileSystemImageCache } from '@modules/exercises/infrastructure/expo-file-system-image-cache';
import { ExpoPhotoPicker } from '@modules/exercises/infrastructure/expo-photo-picker';
import { ExpoPhotoStore } from '@modules/exercises/infrastructure/expo-photo-store';
import { SqliteBuiltInImageCatalog } from '@modules/exercises/infrastructure/sqlite-built-in-image-catalog';
import { SqliteBuiltInLibraryStore } from '@modules/exercises/infrastructure/sqlite-built-in-library-store';
import { SqliteExerciseReader } from '@modules/exercises/infrastructure/sqlite-exercise-reader';
import { SqliteExerciseWriter } from '@modules/exercises/infrastructure/sqlite-exercise-writer';
import { SqliteVocabularyReader } from '@modules/exercises/infrastructure/sqlite-vocabulary-reader';
import { IdGeneratorToken } from '@shared/application/id-generator';
import { SqliteDatabaseToken } from '@shared/infrastructure/db/sqlite-database';

import type { Container, Resolver } from './container';

/**
 * Exercises ports → adapters (Sprint 1, ADR-004), part of the composition root: the SQLite
 * repositories, the bundled seed, the image cache and the photo services, plus the data credits
 * read from the seed manifest. Expects `IdGeneratorToken` and `SqliteDatabaseToken` to be
 * registered by the caller. Lazy singletons: the database is opened only on first use.
 */
export function registerExerciseAdapters(container: Container): Container {
  const database = (resolver: Resolver) => resolver.resolve(SqliteDatabaseToken);
  return (
    container
      .register(ExerciseReaderToken, (resolver) => new SqliteExerciseReader(database(resolver)))
      .register(ExerciseWriterToken, (resolver) => new SqliteExerciseWriter(database(resolver)))
      .register(VocabularyReaderToken, (resolver) => new SqliteVocabularyReader(database(resolver)))
      .register(
        BuiltInImageCatalogToken,
        (resolver) => new SqliteBuiltInImageCatalog(database(resolver)),
      )
      .register(
        BuiltInLibraryStoreToken,
        (resolver) => new SqliteBuiltInLibraryStore(database(resolver)),
      )
      .register(ExerciseSeedSourceToken, () => createBundledExerciseSeedSource())
      // One single-flight cache per container, so on-demand images and the bulk download never
      // fetch the same image twice (ADR-004 §5).
      .register(
        BuiltInImageCacheToken,
        (resolver) =>
          new SingleFlightImageCache(
            new ExpoFileSystemImageCache({
              imageBaseUrl: resolver.resolve(ExerciseSeedSourceToken).manifest.imageBaseUrl,
            }),
          ),
      )
      .register(PhotoPickerToken, () => new ExpoPhotoPicker())
      .register(
        PhotoStoreToken,
        (resolver) => new ExpoPhotoStore({ idGenerator: resolver.resolve(IdGeneratorToken) }),
      )
      .register(ExerciseDataCreditsToken, (resolver) => {
        const { name, repositoryUrl, licence } =
          resolver.resolve(ExerciseSeedSourceToken).manifest.source;
        return Object.freeze({
          datasetName: name,
          repositoryUrl,
          licenceName: licence.name,
          licenceUrl: licence.url,
        });
      })
  );
}
