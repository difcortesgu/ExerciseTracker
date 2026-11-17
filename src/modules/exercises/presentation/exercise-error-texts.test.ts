import { domainError } from '@shared/domain/domain-error';

import {
  addOwnValueErrorMessage,
  exerciseErrorMessage,
  photoErrorMessage,
} from './exercise-error-texts';

describe('exerciseErrorMessage', () => {
  it.each([
    ['exercises.seedAssetInvalid', 'The built-in exercises could not be read. Try again.'],
    ['exercises.seedFailed', 'The built-in exercises could not be saved on this phone. Try again.'],
    [
      'exercises.storageFailed',
      'Your exercises could not be read or saved on this phone. Try again.',
    ],
    ['exercises.notFound', 'This exercise does not exist any more.'],
    ['exercises.builtInReadOnly', 'Built-in exercises cannot be changed.'],
  ] as const)('explains %s without technical details', (code, expected) => {
    expect(exerciseErrorMessage(domainError(code, 'SQLITE_BUSY: database is locked'))).toBe(
      expected,
    );
  });
});

describe('photoErrorMessage', () => {
  it('explains how to allow camera access, and that the gallery still works', () => {
    const error = domainError('exercises.photoPermissionDenied', 'denied', { source: 'camera' });

    expect(photoErrorMessage(error)).toBe(
      'Camera access is off. To allow it, open Android Settings > Apps > Exercise Tracker > ' +
        'Permissions. You can still choose a photo from the gallery.',
    );
  });

  it('explains how to allow photo access, and that the camera still works', () => {
    const error = domainError('exercises.photoPermissionDenied', 'denied', { source: 'library' });

    expect(photoErrorMessage(error)).toBe(
      'Photo access is off. To allow it, open Android Settings > Apps > Exercise Tracker > ' +
        'Permissions. You can still take a photo with the camera.',
    );
  });

  it.each([
    'exercises.photoPickerFailed',
    'exercises.photoImportFailed',
    'exercises.photoStorageFailed',
  ] as const)('says the photo could not be added for %s', (code) => {
    expect(photoErrorMessage(domainError(code, 'disk full'))).toBe(
      "Couldn't add the photo. Try again.",
    );
  });
});

describe('addOwnValueErrorMessage', () => {
  it('asks for a value when the new value is blank', () => {
    expect(addOwnValueErrorMessage(domainError('exercises.vocabularyValueRequired', 'blank'))).toBe(
      'Enter a value',
    );
  });

  it('names the maximum when the new value is too long', () => {
    const error = domainError('exercises.vocabularyValueTooLong', 'too long', { maximum: 40 });

    expect(addOwnValueErrorMessage(error)).toBe('Use at most 40 characters');
  });

  it('explains a library failure without technical details', () => {
    expect(addOwnValueErrorMessage(domainError('exercises.storageFailed', 'SQLITE_BUSY'))).toBe(
      'Your exercises could not be read or saved on this phone. Try again.',
    );
  });
});
