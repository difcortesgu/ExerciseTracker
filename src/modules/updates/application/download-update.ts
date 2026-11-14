import { createToken } from '@shared/application/di/token';
import type { Logger } from '@shared/application/logger';

import type { Release } from '../domain/release';

import type { ApkDownloader, DownloadProgress, DownloadTask } from './apk-downloader';

/**
 * Use case: downloads the APK of an offered release with progress (S05-09). Each call starts a
 * fresh download from zero (Retry = call again). Failures other than a user cancel are logged
 * through the Logger port; the returned task's `result` never rejects.
 */
export type DownloadUpdate = (
  release: Release,
  onProgress: (progress: DownloadProgress) => void,
) => DownloadTask;

export const DownloadUpdateToken = createToken<DownloadUpdate>('updates.DownloadUpdate');

export interface DownloadUpdateDependencies {
  readonly downloader: ApkDownloader;
  readonly logger: Logger;
}

export function createDownloadUpdate(deps: DownloadUpdateDependencies): DownloadUpdate {
  return (release, onProgress) => {
    const task = deps.downloader.start({
      url: release.apk.downloadUrl,
      expectedSizeBytes: release.apk.sizeBytes,
      onProgress,
    });
    const result = task.result.then((outcome) => {
      if (!outcome.ok && outcome.error.code !== 'updates.downloadCancelled') {
        deps.logger.warn('Update download failed.', {
          code: outcome.error.code,
          details: outcome.error.details,
        });
      }
      return outcome;
    });
    return { result, cancel: () => task.cancel() };
  };
}
