import type { Logger } from '@shared/application/logger';

import type { PhotoFileName } from '../domain/exercise';

import type { PhotoStore } from './photo-ports';

export interface PhotoCleanupDependencies {
  readonly photoStore: PhotoStore;
  readonly logger: Logger;
}

/**
 * Best-effort deletion of photo files after the exercise change was saved (S1-21, S1-22): nothing
 * to delete → no call; a failure is logged only (the orphan cleanup removes the files at a later
 * start), never undoing the saved change.
 */
export async function deletePhotosLogged(
  { photoStore, logger }: PhotoCleanupDependencies,
  fileNames: readonly PhotoFileName[],
): Promise<void> {
  if (fileNames.length === 0) return;
  const deleted = await photoStore.deletePhotos(fileNames);
  if (!deleted.ok) {
    logger.warn('Photo files could not be deleted; they are removed at a later start.', {
      code: deleted.error.code,
      details: deleted.error.details,
    });
  }
}
