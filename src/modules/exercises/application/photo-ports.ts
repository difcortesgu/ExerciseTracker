import { createToken } from '@shared/application/di/token';
import type { DomainError } from '@shared/domain/domain-error';
import type { Result } from '@shared/domain/result';

import type { PhotoFileName } from '../domain/exercise';

/** Where the user takes a custom photo from (S1-22). */
export type PhotoSource = 'camera' | 'library';

/** A photo just picked or taken; `uri` is temporary and owned by the picker/OS, never stored. */
export interface PickedPhoto {
  readonly uri: string;
  readonly width: number;
  readonly height: number;
}

export type PhotoPickerErrorCode =
  /** The user denied camera or photo access (`details.source`); the other source may still work. */
  | 'exercises.photoPermissionDenied'
  /** The picker failed for another reason (`details.cause`). */
  | 'exercises.photoPickerFailed';

export type PhotoPickerError = DomainError<PhotoPickerErrorCode>;

/**
 * Port: the system camera / photo picker (expo-image-picker in production, works in Expo Go).
 * Contract: asks for the permission the source needs (if any) before opening it; resolves `ok(null)`
 * when the user cancels; images only, no editing, full quality (the store downscales); never
 * rejects.
 */
export interface PhotoPicker {
  pick(source: PhotoSource): Promise<Result<PickedPhoto | null, PhotoPickerError>>;
}

export const PhotoPickerToken = createToken<PhotoPicker>('exercises.PhotoPicker');

export type PhotoStoreErrorCode =
  /** Downscaling or copying failed (e.g. storage full); no partial file remains (`details.cause`). */
  | 'exercises.photoImportFailed'
  /** Listing or deleting stored photos failed (`details.cause`). */
  | 'exercises.photoStorageFailed';

export type PhotoStoreError = DomainError<PhotoStoreErrorCode>;

/**
 * Port: app-owned storage of custom photos (S1-22, ADR-004 "Custom photos").
 *
 * Contract (shared contract suite: fake and the adapter with expo-file-system and
 * expo-image-manipulator mocked at the native boundary):
 * - `importPhoto` stores a **copy** as JPEG (quality 0.8) downscaled so the longest side is at most
 *   1 600 px (never upscaled) in `Paths.document/exercise-photos/`, under a new unique name; the
 *   copy survives the original being deleted from the gallery; on failure nothing is left behind;
 * - `localUri` returns the stored file's URI, or `null` when it does not exist;
 * - `deletePhotos` is idempotent (missing files are fine);
 * - `listPhotos` returns every stored photo file name;
 * - nothing throws or rejects.
 */
export interface PhotoStore {
  importPhoto(photo: PickedPhoto): Promise<Result<PhotoFileName, PhotoStoreError>>;
  localUri(fileName: PhotoFileName): Promise<string | null>;
  deletePhotos(fileNames: readonly PhotoFileName[]): Promise<Result<void, PhotoStoreError>>;
  listPhotos(): Promise<Result<readonly PhotoFileName[], PhotoStoreError>>;
}

export const PhotoStoreToken = createToken<PhotoStore>('exercises.PhotoStore');
