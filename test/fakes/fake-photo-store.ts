import type {
  PhotoStore,
  PhotoStoreError,
  PickedPhoto,
} from '@modules/exercises/application/photo-ports';
import type { PhotoFileName } from '@modules/exercises/domain/exercise';
import { domainError } from '@shared/domain/domain-error';
import { err, ok, type Result } from '@shared/domain/result';

import { aCustomPhoto } from '../builders/exercise.builder';
import { PHOTO_DIRECTORY_URI } from '../builders/exercise-dtos.builder';

/**
 * Fake `PhotoStore` (S1-22): photo files as an in-memory set, names from a deterministic sequence
 * (`photo-1.jpg`, …), arrangeable import/storage failures, recorded deletions.
 */
export class FakePhotoStore implements PhotoStore {
  readonly deleted: PhotoFileName[] = [];
  readonly imported: PickedPhoto[] = [];
  private readonly photos: Set<PhotoFileName>;
  private readonly originals = new Set<string>();
  private importsFail = false;
  private storageFails = false;
  private sequence = 0;
  private picks = 0;

  constructor(photos: readonly PhotoFileName[] = []) {
    this.photos = new Set(photos);
  }

  /** A photo as the picker returns it, with an existing temporary file. */
  pickedPhoto(size: { width: number; height: number }): PickedPhoto {
    this.picks += 1;
    const uri = `file:///picker/IMG_${this.picks}.jpg`;
    this.originals.add(uri);
    return { uri, ...size };
  }

  deleteOriginal(photo: PickedPhoto): void {
    this.originals.delete(photo.uri);
  }

  failImports(): void {
    this.importsFail = true;
  }

  failStorage(): void {
    this.storageFails = true;
  }

  importPhoto(photo: PickedPhoto): Promise<Result<PhotoFileName, PhotoStoreError>> {
    if (this.importsFail) {
      return Promise.resolve(
        err(
          domainError('exercises.photoImportFailed', 'The photo could not be stored.', {
            cause: 'No space left',
          }),
        ),
      );
    }
    this.sequence += 1;
    this.imported.push(photo);
    const fileName = aCustomPhoto(`photo-${this.sequence}.jpg`).fileName;
    this.photos.add(fileName);
    return Promise.resolve(ok(fileName));
  }

  localUri(fileName: PhotoFileName): Promise<string | null> {
    return Promise.resolve(this.photos.has(fileName) ? `${PHOTO_DIRECTORY_URI}/${fileName}` : null);
  }

  deletePhotos(fileNames: readonly PhotoFileName[]): Promise<Result<void, PhotoStoreError>> {
    if (this.storageFails) return Promise.resolve(err(this.storageFailure()));
    fileNames.forEach((fileName) => {
      this.photos.delete(fileName);
      this.deleted.push(fileName);
    });
    return Promise.resolve(ok(undefined));
  }

  listPhotos(): Promise<Result<readonly PhotoFileName[], PhotoStoreError>> {
    return Promise.resolve(this.storageFails ? err(this.storageFailure()) : ok([...this.photos]));
  }

  private storageFailure(): PhotoStoreError {
    return domainError('exercises.photoStorageFailed', 'Stored photos could not be read.', {
      cause: 'I/O error',
    });
  }
}
