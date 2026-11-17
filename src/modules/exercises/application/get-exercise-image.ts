import { createToken } from '@shared/application/di/token';
import type { Logger } from '@shared/application/logger';

import type { BuiltInImage } from '../domain/exercise';

import type { BuiltInImageCache } from './built-in-image-cache';
import type { ExerciseImageRef, ImageSource } from './exercise-dtos';
import type { PhotoStore } from './photo-ports';

/**
 * Use case: something displayable for an image or photo (S1-17, S1-18, S1-22). Presentation
 * passes the returned `file://` URI to `expo-image`; it never builds a remote URL itself.
 *
 * - Custom photo → its `PhotoStore.localUri`, or `unavailable` if the file is missing.
 * - Built-in image → its cached URI; otherwise one download through the shared, single-flight
 *   `BuiltInImageCache` (the same cache as the bulk download, so never downloaded twice) and the
 *   new URI; on failure or cancel → `unavailable` (the next view retries).
 * Never rejects. On-demand failures are logged at `info` level only (scrolling offline must not
 * flood the log).
 *
 * Phase 2: `createGetExerciseImage(deps: { imageCache: BuiltInImageCache; photoStore; logger })`.
 */
export type GetExerciseImage = (image: ExerciseImageRef) => Promise<ImageSource>;

export const GetExerciseImageToken = createToken<GetExerciseImage>('exercises.GetExerciseImage');

export interface GetExerciseImageDependencies {
  readonly imageCache: BuiltInImageCache;
  readonly photoStore: PhotoStore;
  readonly logger: Logger;
}

const UNAVAILABLE: ImageSource = Object.freeze({ status: 'unavailable' });

const sourceOf = (uri: string | null): ImageSource =>
  uri === null ? UNAVAILABLE : Object.freeze({ status: 'available', uri });

async function builtInSource(
  { imageCache, logger }: GetExerciseImageDependencies,
  { path }: BuiltInImage,
): Promise<ImageSource> {
  const cached = await imageCache.localUri(path);
  if (cached !== null) return sourceOf(cached);
  const downloaded = await imageCache.download(path).result;
  if (downloaded.ok) return sourceOf(downloaded.value);
  logger.info('An exercise image is not available offline.', {
    code: downloaded.error.code,
    path,
  });
  return UNAVAILABLE;
}

export function createGetExerciseImage(deps: GetExerciseImageDependencies): GetExerciseImage {
  return async (image) =>
    image.kind === 'photo'
      ? sourceOf(await deps.photoStore.localUri(image.fileName))
      : builtInSource(deps, image);
}
