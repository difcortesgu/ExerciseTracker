import { Directory, File, Paths } from 'expo-file-system';

import { describeCause } from '@shared/domain/describe-cause';
import { domainError } from '@shared/domain/domain-error';
import { err, ok, type Result } from '@shared/domain/result';

import type {
  ApkDownloader,
  DownloadedApk,
  DownloadError,
  DownloadErrorCode,
  DownloadRequest,
  DownloadTask,
} from '../application/apk-downloader';

/** Sub-folder of the app cache for update downloads (ADR-003). */
export const UPDATES_CACHE_DIRECTORY = 'updates';
/** One fixed file name, so a new download replaces the previous APK instead of piling up. */
export const UPDATE_APK_FILE_NAME = 'update.apk';

type DownloadResult = Result<DownloadedApk, DownloadError>;
type Details = Readonly<Record<string, unknown>>;

function failure(
  code: DownloadErrorCode,
  message: string,
  details: Details,
  cleanupFailure: string | undefined,
): DownloadResult {
  const allDetails = cleanupFailure === undefined ? details : { ...details, cleanupFailure };
  return err(
    domainError(code, message, Object.keys(allDetails).length === 0 ? undefined : allDetails),
  );
}

/** Deletes the file if present; a failure is returned as a description (cleanup never throws). */
function removeFile(file: File): string | undefined {
  try {
    if (file.exists) file.delete();
    return undefined;
  } catch (cause) {
    return describeCause(cause);
  }
}

/**
 * Adapter (ports & adapters): the `ApkDownloader` port over `expo-file-system`
 * (`File.downloadFileAsync` with progress and an `AbortSignal`; works in Expo Go). Downloads to
 * `<cache>/updates/update.apk`, deletes it before starting and after any failure, cancel or size
 * mismatch, and never rejects.
 */
export class ExpoApkDownloader implements ApkDownloader {
  start(request: DownloadRequest): DownloadTask {
    const controller = new AbortController();
    return {
      result: this.download(request, controller.signal),
      cancel: () => controller.abort(),
    };
  }

  private async download(request: DownloadRequest, signal: AbortSignal): Promise<DownloadResult> {
    const directory = new Directory(Paths.cache, UPDATES_CACHE_DIRECTORY);
    const file = new File(directory, UPDATE_APK_FILE_NAME);
    try {
      directory.create({ intermediates: true, idempotent: true });
      if (file.exists) file.delete();
      const downloaded = await File.downloadFileAsync(request.url, file, {
        idempotent: true,
        signal,
        // The server's total may be -1 (no Content-Length); the release size is authoritative.
        onProgress: ({ bytesWritten }) =>
          request.onProgress({
            receivedBytes: bytesWritten,
            totalBytes: request.expectedSizeBytes,
          }),
      });
      return verifySize(downloaded, request.expectedSizeBytes);
    } catch (cause) {
      const cleanupFailure = removeFile(file);
      return signal.aborted
        ? failure('updates.downloadCancelled', 'The download was cancelled.', {}, cleanupFailure)
        : failure(
            'updates.downloadFailed',
            'The update could not be downloaded.',
            { cause: describeCause(cause) },
            cleanupFailure,
          );
    }
  }
}

function verifySize(downloaded: File, expectedSizeBytes: number): DownloadResult {
  const actualSizeBytes = downloaded.size;
  if (actualSizeBytes === expectedSizeBytes) {
    return ok(Object.freeze({ fileUri: downloaded.uri, sizeBytes: actualSizeBytes }));
  }
  return failure(
    'updates.downloadSizeMismatch',
    'The downloaded file does not have the size of the release.',
    { expectedSizeBytes, actualSizeBytes },
    removeFile(downloaded),
  );
}
