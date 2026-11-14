import { createToken } from '@shared/application/di/token';
import type { DomainError } from '@shared/domain/domain-error';
import type { Result } from '@shared/domain/result';

import type { HttpsUrl } from '../domain/release';

/** Progress of a running download. `totalBytes` is the expected size from the release. */
export interface DownloadProgress {
  readonly receivedBytes: number;
  readonly totalBytes: number;
}

/** A completed, size-verified APK in app-private storage. */
export interface DownloadedApk {
  /** Local `file://` URI of the APK. */
  readonly fileUri: string;
  readonly sizeBytes: number;
}

export type DownloadErrorCode =
  /** Network lost, HTTP error, storage full or any other I/O failure (details carry the cause). */
  | 'updates.downloadFailed'
  /** `cancel()` was called before the download completed. */
  | 'updates.downloadCancelled'
  /** The completed file's size differs from `expectedSizeBytes`. */
  | 'updates.downloadSizeMismatch';

export type DownloadError = DomainError<DownloadErrorCode>;

export interface DownloadRequest {
  readonly url: HttpsUrl;
  readonly expectedSizeBytes: number;
  /** Called as data arrives (any number of times, `receivedBytes` never decreasing). */
  readonly onProgress: (progress: DownloadProgress) => void;
}

/**
 * A running download. `result` never rejects. `cancel()` is idempotent and a no-op once `result`
 * has settled; after a cancel, `result` resolves with `updates.downloadCancelled`.
 */
export interface DownloadTask {
  readonly result: Promise<Result<DownloadedApk, DownloadError>>;
  cancel(): void;
}

/**
 * Port: downloads an update APK with progress (S05-09).
 *
 * Contract (shared contract suite, fake + Expo adapter with the native module mocked):
 * - downloads to one fixed file in app-private cache storage, replacing any APK from an earlier
 *   attempt or build, so downloads never pile up;
 * - verifies the completed file's size against `expectedSizeBytes` (integrity check; only the
 *   adapter can verify and delete atomically) and returns `updates.downloadSizeMismatch` when it
 *   differs;
 * - on failure, cancellation or size mismatch, deletes the partial/invalid file before `result`
 *   settles.
 */
export interface ApkDownloader {
  start(request: DownloadRequest): DownloadTask;
}

export const ApkDownloaderToken = createToken<ApkDownloader>('updates.ApkDownloader');
