import { BuiltInImageCacheToken } from './built-in-image-cache';
import { CleanUpOrphanPhotosToken } from './clean-up-orphan-photos';
import { CreateCustomExerciseToken } from './create-custom-exercise';
import { ExerciseDataCreditsToken } from './data-credits';
import { DeleteCustomExerciseToken } from './delete-custom-exercise';
import { DiscardPhotosToken } from './discard-photos';
import { EnsureLibrarySeededToken } from './ensure-library-seeded';
import {
  BuiltInImageCatalogToken,
  ExerciseReaderToken,
  ExerciseWriterToken,
  VocabularyReaderToken,
} from './exercise-repository';
import { FindExercisesToken } from './find-exercises';
import { GetExerciseDetailsToken } from './get-exercise-details';
import { GetExerciseFormValuesToken } from './get-exercise-form-values';
import { GetExerciseImageToken } from './get-exercise-image';
import { ImportPhotoToken } from './import-photo';
import { BuiltInLibraryStoreToken, ExerciseSeedSourceToken } from './library-seed-ports';
import { ListVocabularyOptionsToken } from './list-vocabulary-options';
import { OfflineImagesToken } from './offline-images';
import { PhotoPickerToken, PhotoStoreToken } from './photo-ports';
import { PrepareDuplicateToken } from './prepare-duplicate';
import { ResolveVocabularyValueToken } from './resolve-vocabulary-value';
import { UpdateCustomExerciseToken } from './update-custom-exercise';

const TOKENS = [
  // Ports (implemented by infrastructure adapters, wired in src/core/di)
  [ExerciseReaderToken, 'exercises.ExerciseReader'],
  [ExerciseWriterToken, 'exercises.ExerciseWriter'],
  [VocabularyReaderToken, 'exercises.VocabularyReader'],
  [BuiltInImageCatalogToken, 'exercises.BuiltInImageCatalog'],
  [ExerciseSeedSourceToken, 'exercises.ExerciseSeedSource'],
  [BuiltInLibraryStoreToken, 'exercises.BuiltInLibraryStore'],
  [BuiltInImageCacheToken, 'exercises.BuiltInImageCache'],
  [PhotoPickerToken, 'exercises.PhotoPicker'],
  [PhotoStoreToken, 'exercises.PhotoStore'],
  // Use cases, services and values (resolved by presentation and the bootstrap sequence)
  [EnsureLibrarySeededToken, 'exercises.EnsureLibrarySeeded'],
  [FindExercisesToken, 'exercises.FindExercises'],
  [GetExerciseDetailsToken, 'exercises.GetExerciseDetails'],
  [ListVocabularyOptionsToken, 'exercises.ListVocabularyOptions'],
  [ResolveVocabularyValueToken, 'exercises.ResolveVocabularyValue'],
  [CreateCustomExerciseToken, 'exercises.CreateCustomExercise'],
  [UpdateCustomExerciseToken, 'exercises.UpdateCustomExercise'],
  [DeleteCustomExerciseToken, 'exercises.DeleteCustomExercise'],
  [GetExerciseFormValuesToken, 'exercises.GetExerciseFormValues'],
  [PrepareDuplicateToken, 'exercises.PrepareDuplicate'],
  [ImportPhotoToken, 'exercises.ImportPhoto'],
  [DiscardPhotosToken, 'exercises.DiscardPhotos'],
  [CleanUpOrphanPhotosToken, 'exercises.CleanUpOrphanPhotos'],
  [GetExerciseImageToken, 'exercises.GetExerciseImage'],
  [OfflineImagesToken, 'exercises.OfflineImages'],
  [ExerciseDataCreditsToken, 'exercises.ExerciseDataCredits'],
] as const;

describe('exercises port, use-case and service tokens', () => {
  it.each(TOKENS)('names its token after the port or use case (%#)', (token, description) => {
    expect(token.description).toBe(description);
  });

  it('gives every port and use case its own token', () => {
    const keys = TOKENS.map(([token]) => token.key);

    expect(new Set(keys).size).toBe(keys.length);
  });
});
