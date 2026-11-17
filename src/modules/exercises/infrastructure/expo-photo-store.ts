import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { IdGenerator } from '@shared/application/id-generator';
import { describeCause } from '@shared/domain/describe-cause';
import { domainError } from '@shared/domain/domain-error';
import { err, ok, type Result } from '@shared/domain/result';

import type { PhotoStore, PhotoStoreError, PickedPhoto } from '../application/photo-ports';
import { parsePhotoFileName, type PhotoFileName } from '../domain/exercise';
import {
  CUSTOM_PHOTO_DIRECTORY,
  PHOTO_FILE_EXTENSION,
  PHOTO_JPEG_QUALITY,
  PHOTO_MAX_LONGEST_SIDE_PX,
} from './exercise-image-config';
import { removeFileQuietly } from './file-cleanup';

export interface ExpoPhotoStoreDeps {
  readonly idGenerator: IdGenerator;
}

type ResizeTarget = { readonly width: number } | { readonly height: number };

/**
 * Adapter (ports & adapters): the `PhotoStore` port over `expo-image-manipulator` and
 * `expo-file-system` (both work in Expo Go), ADR-004 §7. An import decodes the picked image,
 * downscales it so the longest side is at most 1 600 px (never upscales), encodes JPEG 0.8 into the
 * manipulator's cache and moves that file to `Paths.document/exercise-photos/<id>.jpg`: an
 * app-owned copy that survives the original being deleted. A failed import removes what it wrote.
 * Never rejects.
 */
export class ExpoPhotoStore implements PhotoStore {
  constructor(private readonly deps: ExpoPhotoStoreDeps) {}

  async importPhoto(photo: PickedPhoto): Promise<Result<PhotoFileName, PhotoStoreError>> {
    const fileName = parsePhotoFileName(`${this.deps.idGenerator.next()}${PHOTO_FILE_EXTENSION}`);
    if (!fileName.ok) return importFailed(fileName.error.message);
    const target = photoFile(fileName.value);
    // A fresh name never exists; refusing here keeps the cleanup below from touching a kept photo.
    if (target.exists) return importFailed(`${fileName.value} already exists.`);
    let encoded: File | undefined;
    try {
      encoded = new File(await encodeDownscaledJpeg(photo));
      target.parentDirectory.create({ intermediates: true, idempotent: true });
      encoded.moveSync(target);
      return ok(fileName.value);
    } catch (cause) {
      if (encoded !== undefined) removeFileQuietly(encoded);
      removeFileQuietly(target);
      return importFailed(describeCause(cause));
    }
  }

  // `File` construction cannot throw here: a `PhotoFileName` is validated by the domain.
  localUri(fileName: PhotoFileName): Promise<string | null> {
    const file = photoFile(fileName);
    return Promise.resolve(file.exists ? file.uri : null);
  }

  deletePhotos(fileNames: readonly PhotoFileName[]): Promise<Result<void, PhotoStoreError>> {
    try {
      fileNames.map(photoFile).forEach((file) => {
        if (file.exists) file.delete();
      });
      return Promise.resolve(ok(undefined));
    } catch (cause) {
      return Promise.resolve(storageFailed('Stored photos could not be deleted.', cause));
    }
  }

  listPhotos(): Promise<Result<readonly PhotoFileName[], PhotoStoreError>> {
    try {
      const directory = photosDirectory();
      return Promise.resolve(ok(directory.exists ? photoFileNamesIn(directory) : []));
    } catch (cause) {
      return Promise.resolve(storageFailed('Stored photos could not be listed.', cause));
    }
  }
}

/** Decodes, downscales if needed and encodes the photo; resolves the encoded file's URI. */
async function encodeDownscaledJpeg(photo: PickedPhoto): Promise<string> {
  const context = ImageManipulator.manipulate(photo.uri);
  const resize = downscaleTarget(photo);
  if (resize !== null) context.resize(resize);
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: PHOTO_JPEG_QUALITY });
  return saved.uri;
}

/** The longest side limited to the maximum (the manipulator keeps the aspect ratio), or `null`. */
function downscaleTarget({ width, height }: PickedPhoto): ResizeTarget | null {
  if (Math.max(width, height) <= PHOTO_MAX_LONGEST_SIDE_PX) return null;
  return width >= height
    ? { width: PHOTO_MAX_LONGEST_SIDE_PX }
    : { height: PHOTO_MAX_LONGEST_SIDE_PX };
}

function photosDirectory(): Directory {
  return new Directory(Paths.document, CUSTOM_PHOTO_DIRECTORY);
}

function photoFile(fileName: PhotoFileName): File {
  return new File(photosDirectory(), fileName);
}

function photoFileNamesIn(directory: Directory): readonly PhotoFileName[] {
  return directory.list().flatMap((entry) => {
    if (!(entry instanceof File)) return [];
    const parsed = parsePhotoFileName(entry.uri.slice(directory.uri.length + 1));
    return parsed.ok ? [parsed.value] : [];
  });
}

function importFailed(cause: string): Result<never, PhotoStoreError> {
  return err(
    domainError('exercises.photoImportFailed', 'The photo could not be stored.', { cause }),
  );
}

function storageFailed(message: string, cause: unknown): Result<never, PhotoStoreError> {
  return err(domainError('exercises.photoStorageFailed', message, { cause: describeCause(cause) }));
}
