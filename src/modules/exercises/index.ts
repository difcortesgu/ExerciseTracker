/**
 * Public API of the `exercises` module (Sprint 1, exercise library; ADR-004). Other modules,
 * `app/` routes and the composition root may import this module only through this file (enforced
 * by eslint-plugin-boundaries).
 *
 * Rules (docs/ENGINEERING_STANDARDS.md §1.3, ADR-001):
 * - Re-exports only (`export … from`); no logic here (enforced by lint).
 * - Export use cases, DTOs, port interfaces, DI tokens and presentation screens.
 * - Never export infrastructure adapters; they are wired in `src/core/di` only.
 * Phase 2: core-dev adds the domain functions it implements next to these types (if other modules
 * or presentation need them); ui-dev adds presentation exports only.
 */

// Domain: the Exercise aggregate, vocabularies, tracked metrics, errors (S1-08, S1-29)
export {
  parseDatasetImagePath,
  isCustomExercise,
  parsePhotoFileName,
  parseSeedSourceKey,
  type BuiltInExercise,
  type BuiltInExerciseData,
  type BuiltInImage,
  type CustomExercise,
  type CustomPhoto,
  type DatasetImagePath,
  type Exercise,
  type ExerciseForce,
  type ExerciseImage,
  type ExerciseLevel,
  type ExerciseMechanic,
  type ExerciseOrigin,
  type PhotoFileName,
  type SeedSourceKey,
} from './domain/exercise';
export { comparisonKey, normaliseDisplayText, type ComparisonKey } from './domain/comparison-key';
export {
  EXERCISE_LIMITS,
  formatInstructions,
  parseInstructions,
  type ExerciseDraft,
  type ValidatedExerciseDraft,
} from './domain/exercise-draft';
export type {
  BuiltInReadOnlyError,
  ExerciseField,
  ExerciseFieldErrorCode,
  ExerciseFieldIssue,
  ExerciseNotFoundError,
  ExerciseValidationError,
  InvalidExerciseDataError,
  VocabularyValueError,
} from './domain/exercise-errors';
export { EMPTY_EXERCISE_QUERY, type ExerciseQuery } from './domain/exercise-query';
export type { ExerciseSummary } from './domain/exercise-summary';
export type { LibrarySeedPlan } from './domain/library-seed';
export {
  TRACKED_METRICS,
  normaliseTrackedMetrics,
  type TrackedMetric,
} from './domain/tracked-metric';
export {
  VOCABULARY_VALUE_MAX_LENGTH,
  type ResolvedVocabularyValue,
  type Vocabulary,
  type VocabularyKey,
  type VocabularyKind,
  type VocabularyOrigin,
  type VocabularySelection,
  type VocabularyValue,
} from './domain/vocabulary';

// Application: ports (S1-12, S1-14, S1-18, S1-22, S1-28, S1-29)
export {
  BuiltInImageCatalogToken,
  ExerciseReaderToken,
  ExerciseWriterToken,
  VocabularyReaderToken,
  type BuiltInImageCatalog,
  type ExerciseReader,
  type ExerciseStorageError,
  type ExerciseWriter,
  type FindExerciseOptions,
  type VocabularyReader,
} from './application/exercise-repository';
export {
  BuiltInLibraryStoreToken,
  ExerciseSeedSourceToken,
  type BuiltInLibraryStore,
  type DatasetSource,
  type ExerciseSeedSource,
  type SeedDataset,
  type SeedManifest,
  type SeedSourceError,
} from './application/library-seed-ports';
export {
  BuiltInImageCacheToken,
  type BuiltInImageCache,
  type ImageDownloadError,
  type ImageDownloadErrorCode,
  type ImageDownloadTask,
} from './application/built-in-image-cache';
export {
  PhotoPickerToken,
  PhotoStoreToken,
  type PhotoPicker,
  type PhotoPickerError,
  type PhotoPickerErrorCode,
  type PhotoSource,
  type PhotoStore,
  type PhotoStoreError,
  type PhotoStoreErrorCode,
  type PickedPhoto,
} from './application/photo-ports';

// Application: DTOs and errors used by presentation
export type {
  BuiltInAttributes,
  ExerciseDetails,
  ExerciseFormValues,
  ExerciseImageRef,
  ExerciseInput,
  ExerciseListItem,
  ExerciseSearchQuery,
  ImageSource,
  PhotoView,
  ResolvedVocabularyOption,
  VocabularyOption,
  VocabularyOptions,
} from './application/exercise-dtos';
export type {
  ExerciseLibraryError,
  ExerciseLookupError,
  LibrarySeedError,
} from './application/library-errors';
export type { DeleteExerciseError, SaveExerciseError } from './application/save-exercise-errors';

// Application: use cases and services (S1-12 to S1-29)
export {
  EnsureLibrarySeededToken,
  type EnsureLibrarySeeded,
  type LibrarySeedReport,
} from './application/ensure-library-seeded';
export { FindExercisesToken, type FindExercises } from './application/find-exercises';
export {
  GetExerciseDetailsToken,
  type GetExerciseDetails,
} from './application/get-exercise-details';
export {
  ListVocabularyOptionsToken,
  type ListVocabularyOptions,
} from './application/list-vocabulary-options';
export {
  ResolveVocabularyValueToken,
  type ResolveVocabularyValue,
} from './application/resolve-vocabulary-value';
export {
  CreateCustomExerciseToken,
  type CreateCustomExercise,
} from './application/create-custom-exercise';
export {
  UpdateCustomExerciseToken,
  type UpdateCustomExercise,
} from './application/update-custom-exercise';
export {
  DeleteCustomExerciseToken,
  type DeleteCustomExercise,
} from './application/delete-custom-exercise';
export {
  GetExerciseFormValuesToken,
  type GetExerciseFormValues,
} from './application/get-exercise-form-values';
export { PrepareDuplicateToken, type PrepareDuplicate } from './application/prepare-duplicate';
export { ImportPhotoToken, type ImportPhoto } from './application/import-photo';
export { DiscardPhotosToken, type DiscardPhotos } from './application/discard-photos';
export {
  CleanUpOrphanPhotosToken,
  type CleanUpOrphanPhotos,
} from './application/clean-up-orphan-photos';
export { GetExerciseImageToken, type GetExerciseImage } from './application/get-exercise-image';
export {
  OfflineImagesToken,
  type OfflineImages,
  type OfflineImagesEstimate,
  type OfflineImagesState,
} from './application/offline-images';
export { ExerciseDataCreditsToken, type ExerciseDataCredits } from './application/data-credits';

// Presentation: library tab, detail, forms and the offline-images section (S1-16 to S1-29)
export { ExercisesScreen } from './presentation/exercises-screen';
export { ExerciseDetailScreen } from './presentation/exercise-detail-screen';
export { EditExerciseScreen, NewExerciseScreen } from './presentation/exercise-form-screen';
export { OfflineImagesSection } from './presentation/offline-images-section';
