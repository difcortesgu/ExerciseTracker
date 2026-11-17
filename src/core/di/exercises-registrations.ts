import type { StartupTask } from '@core/bootstrap/startup-task';
import { BuiltInImageCacheToken } from '@modules/exercises/application/built-in-image-cache';
import {
  CleanUpOrphanPhotosToken,
  createCleanUpOrphanPhotos,
} from '@modules/exercises/application/clean-up-orphan-photos';
import {
  createCreateCustomExercise,
  CreateCustomExerciseToken,
} from '@modules/exercises/application/create-custom-exercise';
import {
  createDeleteCustomExercise,
  DeleteCustomExerciseToken,
} from '@modules/exercises/application/delete-custom-exercise';
import {
  createDiscardPhotos,
  DiscardPhotosToken,
} from '@modules/exercises/application/discard-photos';
import {
  createEnsureLibrarySeeded,
  EnsureLibrarySeededToken,
} from '@modules/exercises/application/ensure-library-seeded';
import {
  BuiltInImageCatalogToken,
  ExerciseReaderToken,
  ExerciseWriterToken,
  VocabularyReaderToken,
} from '@modules/exercises/application/exercise-repository';
import {
  createFindExercises,
  FindExercisesToken,
} from '@modules/exercises/application/find-exercises';
import {
  createGetExerciseDetails,
  GetExerciseDetailsToken,
} from '@modules/exercises/application/get-exercise-details';
import {
  createGetExerciseFormValues,
  GetExerciseFormValuesToken,
} from '@modules/exercises/application/get-exercise-form-values';
import {
  createGetExerciseImage,
  GetExerciseImageToken,
} from '@modules/exercises/application/get-exercise-image';
import { createImportPhoto, ImportPhotoToken } from '@modules/exercises/application/import-photo';
import {
  BuiltInLibraryStoreToken,
  ExerciseSeedSourceToken,
} from '@modules/exercises/application/library-seed-ports';
import {
  createListVocabularyOptions,
  ListVocabularyOptionsToken,
} from '@modules/exercises/application/list-vocabulary-options';
import {
  createOfflineImages,
  OfflineImagesToken,
} from '@modules/exercises/application/offline-images';
import { PhotoPickerToken, PhotoStoreToken } from '@modules/exercises/application/photo-ports';
import {
  createPrepareDuplicate,
  PrepareDuplicateToken,
} from '@modules/exercises/application/prepare-duplicate';
import {
  createResolveVocabularyValue,
  ResolveVocabularyValueToken,
} from '@modules/exercises/application/resolve-vocabulary-value';
import {
  createUpdateCustomExercise,
  UpdateCustomExerciseToken,
} from '@modules/exercises/application/update-custom-exercise';
import { IdGeneratorToken } from '@shared/application/id-generator';
import { LoggerToken } from '@shared/application/logger';

import type { Container, Resolver } from './container';
import { registerExerciseAdapters } from './exercise-adapter-registrations';

/**
 * Exercises module wiring (Sprint 1, ADR-004), part of the composition root: its adapters (see
 * `registerExerciseAdapters`) and its use cases and services. Expects the shared `LoggerToken`,
 * `IdGeneratorToken` and `SqliteDatabaseToken` to be registered by the caller. Every registration
 * is a lazy singleton; nothing (not even the database) is touched before a screen or a startup
 * task resolves it.
 */
export function registerExercises(container: Container): Container {
  return registerExerciseUseCases(registerExerciseAdapters(container));
}

/** The startup work of the module, in order (S1-13, S1-22); resolved only when a task runs. */
export function exercisesStartupTasks(resolver: Resolver): readonly StartupTask[] {
  return Object.freeze([
    {
      name: 'exercises.EnsureLibrarySeeded',
      run: () => resolver.resolve(EnsureLibrarySeededToken)(),
    },
    {
      name: 'exercises.CleanUpOrphanPhotos',
      run: () => resolver.resolve(CleanUpOrphanPhotosToken)(),
    },
  ]);
}

/** What most library use cases need: seeded library, readers and the logger. */
function libraryDependencies(resolver: Resolver) {
  return {
    ensureLibrarySeeded: resolver.resolve(EnsureLibrarySeededToken),
    reader: resolver.resolve(ExerciseReaderToken),
    vocabularyReader: resolver.resolve(VocabularyReaderToken),
    logger: resolver.resolve(LoggerToken),
  };
}

/** What the photo use cases need. */
function photoDependencies(resolver: Resolver) {
  return {
    reader: resolver.resolve(ExerciseReaderToken),
    photoStore: resolver.resolve(PhotoStoreToken),
    logger: resolver.resolve(LoggerToken),
  };
}

/** Use cases and services over the ports registered above. */
function registerExerciseUseCases(container: Container): Container {
  return (
    container
      // Singleton: its memoized promise makes every use case share one seeding run per launch.
      .register(EnsureLibrarySeededToken, (resolver) =>
        createEnsureLibrarySeeded({
          seedSource: resolver.resolve(ExerciseSeedSourceToken),
          store: resolver.resolve(BuiltInLibraryStoreToken),
          idGenerator: resolver.resolve(IdGeneratorToken),
          logger: resolver.resolve(LoggerToken),
        }),
      )
      .register(FindExercisesToken, (resolver) =>
        createFindExercises(libraryDependencies(resolver)),
      )
      .register(GetExerciseDetailsToken, (resolver) =>
        createGetExerciseDetails(libraryDependencies(resolver)),
      )
      .register(PrepareDuplicateToken, (resolver) =>
        createPrepareDuplicate(libraryDependencies(resolver)),
      )
      .register(ListVocabularyOptionsToken, (resolver) =>
        createListVocabularyOptions(libraryDependencies(resolver)),
      )
      .register(ResolveVocabularyValueToken, (resolver) =>
        createResolveVocabularyValue(libraryDependencies(resolver)),
      )
      .register(GetExerciseFormValuesToken, (resolver) =>
        createGetExerciseFormValues({
          ...libraryDependencies(resolver),
          photoStore: resolver.resolve(PhotoStoreToken),
        }),
      )
      .register(CreateCustomExerciseToken, (resolver) =>
        createCreateCustomExercise({
          ...libraryDependencies(resolver),
          writer: resolver.resolve(ExerciseWriterToken),
          idGenerator: resolver.resolve(IdGeneratorToken),
        }),
      )
      .register(UpdateCustomExerciseToken, (resolver) =>
        createUpdateCustomExercise({
          ...libraryDependencies(resolver),
          writer: resolver.resolve(ExerciseWriterToken),
          photoStore: resolver.resolve(PhotoStoreToken),
        }),
      )
      .register(DeleteCustomExerciseToken, (resolver) =>
        createDeleteCustomExercise({
          ...photoDependencies(resolver),
          writer: resolver.resolve(ExerciseWriterToken),
        }),
      )
      .register(DiscardPhotosToken, (resolver) => createDiscardPhotos(photoDependencies(resolver)))
      .register(CleanUpOrphanPhotosToken, (resolver) =>
        createCleanUpOrphanPhotos(photoDependencies(resolver)),
      )
      .register(ImportPhotoToken, (resolver) =>
        createImportPhoto({
          picker: resolver.resolve(PhotoPickerToken),
          photoStore: resolver.resolve(PhotoStoreToken),
          logger: resolver.resolve(LoggerToken),
        }),
      )
      .register(GetExerciseImageToken, (resolver) =>
        createGetExerciseImage({
          imageCache: resolver.resolve(BuiltInImageCacheToken),
          photoStore: resolver.resolve(PhotoStoreToken),
          logger: resolver.resolve(LoggerToken),
        }),
      )
      // Singleton (Observer): a running bulk download survives leaving and reopening Settings.
      .register(OfflineImagesToken, (resolver) =>
        createOfflineImages({
          ensureLibrarySeeded: resolver.resolve(EnsureLibrarySeededToken),
          catalog: resolver.resolve(BuiltInImageCatalogToken),
          imageCache: resolver.resolve(BuiltInImageCacheToken),
          logger: resolver.resolve(LoggerToken),
        }),
      )
  );
}
