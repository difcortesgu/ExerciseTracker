import type { BuiltInReadOnlyError, VocabularyValueError } from '../domain/exercise-errors';
import type { ExerciseLibraryError, ExerciseLookupError } from '../application/library-errors';
import type { PhotoPickerError, PhotoSource, PhotoStoreError } from '../application/photo-ports';

import { issueText } from './exercise-issue-texts';

/**
 * Presenter of the exercises errors that are not field issues (S1-13, S1-16, S1-17, S1-22): a
 * readable sentence per code. Technical details stay in the log (the use cases log them).
 */

type ExerciseErrorCode = ExerciseLookupError['code'] | BuiltInReadOnlyError['code'];

const EXERCISE_ERROR_MESSAGES: Readonly<Record<ExerciseErrorCode, string>> = {
  'exercises.seedAssetInvalid': 'The built-in exercises could not be read. Try again.',
  'exercises.seedFailed': 'The built-in exercises could not be saved on this phone. Try again.',
  'exercises.storageFailed': 'Your exercises could not be read or saved on this phone. Try again.',
  'exercises.notFound': 'This exercise does not exist any more.',
  'exercises.builtInReadOnly': 'Built-in exercises cannot be changed.',
};

export function exerciseErrorMessage(error: { readonly code: ExerciseErrorCode }): string {
  return EXERCISE_ERROR_MESSAGES[error.code];
}

const PERMISSIONS_PATH = 'open Android Settings > Apps > Exercise Tracker > Permissions.';

const PERMISSION_DENIED_MESSAGES: Readonly<Record<PhotoSource, string>> = {
  camera: `Camera access is off. To allow it, ${PERMISSIONS_PATH} You can still choose a photo from the gallery.`,
  library: `Photo access is off. To allow it, ${PERMISSIONS_PATH} You can still take a photo with the camera.`,
};

const PHOTO_NOT_ADDED = "Couldn't add the photo. Try again.";

function isPhotoSource(value: unknown): value is PhotoSource {
  return value === 'camera' || value === 'library';
}

/** S1-22: how to allow a denied source (the other one still works), otherwise a short failure. */
export function photoErrorMessage(error: PhotoPickerError | PhotoStoreError): string {
  const source = error.details?.['source'];
  if (error.code === 'exercises.photoPermissionDenied' && isPhotoSource(source)) {
    return PERMISSION_DENIED_MESSAGES[source];
  }
  return PHOTO_NOT_ADDED;
}

const VOCABULARY_VALUE_CODES: ReadonlySet<string> = new Set<VocabularyValueError['code']>([
  'exercises.vocabularyValueRequired',
  'exercises.vocabularyValueTooLong',
]);

function isVocabularyValueError(
  error: VocabularyValueError | ExerciseLibraryError,
): error is VocabularyValueError {
  return VOCABULARY_VALUE_CODES.has(error.code);
}

/**
 * S1-29: why "Add your own" refused a value. A rejected value gets the same text as the field
 * issue with that code (one text per code, DRY); a library failure gets the general sentence.
 */
export function addOwnValueErrorMessage(
  error: VocabularyValueError | ExerciseLibraryError,
): string {
  return isVocabularyValueError(error) ? issueText(error) : exerciseErrorMessage(error);
}
