import { createToken } from '@shared/application/di/token';
import type { DomainError } from '@shared/domain/domain-error';
import type { Result } from '@shared/domain/result';

import type { DatasetImagePath } from '../domain/exercise';

export type ImageDownloadErrorCode =
  /** Network error, HTTP error (e.g. 404), timeout or storage failure (`details.cause`). */
  | 'exercises.imageDownloadFailed'
  /** `cancel()` was called before the download completed. */
  | 'exercises.imageDownloadCancelled';

export type ImageDownloadError = DomainError<ImageDownloadErrorCode>;

/**
 * A running image download. `result` never rejects and resolves with the local `file://` URI.
 * `cancel()` is idempotent and a no-op once settled; afterwards `result` is
 * `exercises.imageDownloadCancelled`.
 */
export interface ImageDownloadTask {
  readonly result: Promise<Result<string, ImageDownloadError>>;
  cancel(): void;
}

/**
 * Port: the durable local cache of built-in images (S1-18, S1-28, ADR-004 "Images"), shared by the
 * on-demand path and the bulk download, so an image is never downloaded twice.
 *
 * Contract (shared contract suite: fake and the expo-file-system adapter with the native module
 * mocked):
 * - images live in app **document** storage (`Paths.document/exercise-images/<path>`), which
 *   Android does not clear as cache; if the folder is gone anyway, images are simply downloaded
 *   again when next needed (never a broken reference: the database stores only dataset paths);
 * - the URL is the pinned `imageBaseUrl` + path (configuration injected into the adapter);
 * - a download writes to a temporary file and moves it into place only when complete, so a
 *   partial file is never visible, and is removed on failure or cancel;
 * - `download` of an image that is already cached resolves with its URI without a request;
 * - no method throws or rejects.
 * In-flight de-duplication (two callers, one request) is the application decorator
 * `SingleFlightImageCache` (Phase 2), not the adapter's job.
 */
export interface BuiltInImageCache {
  /** The cached file's URI, or `null` when it is not cached. */
  localUri(path: DatasetImagePath): Promise<string | null>;
  /** Every cached path in one listing (bulk estimate); a listing failure counts as nothing cached. */
  cachedPaths(): Promise<ReadonlySet<DatasetImagePath>>;
  download(path: DatasetImagePath): ImageDownloadTask;
}

export const BuiltInImageCacheToken = createToken<BuiltInImageCache>('exercises.BuiltInImageCache');
