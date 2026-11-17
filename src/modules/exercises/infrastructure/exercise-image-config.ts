import type { Brand } from '@shared/domain/brand';

import type { DatasetImagePath } from '../domain/exercise';

/**
 * Where exercise images live and how custom photos are stored (ADR-004 §5 and §7). Configuration
 * for the image adapters only; the pinned image location itself comes from the seed manifest
 * (`manifest.imageBaseUrl`, generated from `tooling/exercise-db/pin.js`) and is injected by the
 * composition root.
 */

/** Folder under `Paths.document` for downloaded built-in images (`<folder>/<dataset path>`). */
export const BUILT_IN_IMAGE_DIRECTORY = 'exercise-images';
/** A download is written to `<file><suffix>` and moved into place only once complete. */
export const PARTIAL_DOWNLOAD_SUFFIX = '.part';

/** Folder under `Paths.document` for app-owned custom photos (`<folder>/<id>.jpg`). */
export const CUSTOM_PHOTO_DIRECTORY = 'exercise-photos';
export const PHOTO_FILE_EXTENSION = '.jpg';
/** Photos are downscaled (never upscaled) so their longest side is at most this many pixels. */
export const PHOTO_MAX_LONGEST_SIDE_PX = 1600;
/** JPEG compression quality of stored photos (0 = smallest, 1 = best). */
export const PHOTO_JPEG_QUALITY = 0.8;

/** The pinned dataset's image location: an `https://` URL ending in `/`. */
export type ImageBaseUrl = Brand<string, 'ImageBaseUrl'>;

const IMAGE_BASE_URL_PATTERN = /^https:\/\/[^\s]+\/$/;

function isImageBaseUrl(raw: string): raw is ImageBaseUrl {
  return IMAGE_BASE_URL_PATTERN.test(raw);
}

/**
 * Validates the manifest's `imageBaseUrl`. A malformed value is a broken build artefact (the
 * manifest is generated), so it throws; the composition-root test constructs the adapter and fails
 * CI instead of the app silently showing no images.
 */
export function parseImageBaseUrl(raw: string): ImageBaseUrl {
  if (!isImageBaseUrl(raw)) {
    throw new Error(`The manifest imageBaseUrl must be an https URL ending in "/": "${raw}".`);
  }
  return raw;
}

/** Download URL of a built-in image: the pinned location + its dataset path (ADR-004 §5). */
export function builtInImageUrl(baseUrl: ImageBaseUrl, path: DatasetImagePath): string {
  return `${baseUrl}${path}`;
}
