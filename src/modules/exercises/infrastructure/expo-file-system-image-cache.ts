import { Directory, File, Paths } from 'expo-file-system';

import { describeCause } from '@shared/domain/describe-cause';
import { domainError } from '@shared/domain/domain-error';
import { err, ok, type Result } from '@shared/domain/result';

import type {
  BuiltInImageCache,
  ImageDownloadError,
  ImageDownloadTask,
} from '../application/built-in-image-cache';
import { parseDatasetImagePath, type DatasetImagePath } from '../domain/exercise';
import {
  BUILT_IN_IMAGE_DIRECTORY,
  builtInImageUrl,
  parseImageBaseUrl,
  PARTIAL_DOWNLOAD_SUFFIX,
  type ImageBaseUrl,
} from './exercise-image-config';
import { removeFileQuietly } from './file-cleanup';

type DownloadResult = Result<string, ImageDownloadError>;

/** What the composition root passes in: the pinned image location from the seed manifest. */
export interface ExpoFileSystemImageCacheConfig {
  readonly imageBaseUrl: string;
}

/**
 * Adapter (ports & adapters): the `BuiltInImageCache` port over `expo-file-system` (works in Expo
 * Go), ADR-004 §5. Images live in `Paths.document/exercise-images/<dataset path>`; a download
 * streams into `<file>.part` and is moved into place only when complete, so a partial image is
 * never visible; the partial file is removed on failure or cancel. Never rejects.
 */
export class ExpoFileSystemImageCache implements BuiltInImageCache {
  private readonly imageBaseUrl: ImageBaseUrl;

  constructor(config: ExpoFileSystemImageCacheConfig) {
    this.imageBaseUrl = parseImageBaseUrl(config.imageBaseUrl);
  }

  // `File` construction cannot throw here: a `DatasetImagePath` is validated by the domain.
  localUri(path: DatasetImagePath): Promise<string | null> {
    const file = imageFile(path);
    return Promise.resolve(file.exists ? file.uri : null);
  }

  cachedPaths(): Promise<ReadonlySet<DatasetImagePath>> {
    try {
      const root = imagesDirectory();
      return Promise.resolve(new Set(root.exists ? listImagePaths(root, root.uri) : []));
    } catch {
      // Contract: a listing failure counts as nothing cached (the bulk run fetches what's missing).
      return Promise.resolve(new Set());
    }
  }

  download(path: DatasetImagePath): ImageDownloadTask {
    const controller = new AbortController();
    return {
      result: this.fetchIntoCache(path, controller.signal),
      cancel: () => controller.abort(),
    };
  }

  private async fetchIntoCache(
    path: DatasetImagePath,
    signal: AbortSignal,
  ): Promise<DownloadResult> {
    const target = imageFile(path);
    if (target.exists) return ok(target.uri);
    const partial = new File(imagesDirectory(), `${path}${PARTIAL_DOWNLOAD_SUFFIX}`);
    try {
      target.parentDirectory.create({ intermediates: true, idempotent: true });
      await File.downloadFileAsync(builtInImageUrl(this.imageBaseUrl, path), partial, {
        idempotent: true,
        signal,
      });
      // Synchronous from here on, so a cancel cannot slip in between this check and settling.
      // (A plain check: React Native's AbortSignal may lack `throwIfAborted`.)
      if (signal.aborted) return failure(true, undefined, removeFileQuietly(partial));
      partial.moveSync(target, { overwrite: true });
      return ok(target.uri);
    } catch (cause) {
      return failure(signal.aborted, cause, removeFileQuietly(partial));
    }
  }
}

function imagesDirectory(): Directory {
  return new Directory(Paths.document, BUILT_IN_IMAGE_DIRECTORY);
}

function imageFile(path: DatasetImagePath): File {
  return new File(imagesDirectory(), path);
}

/** Complete images below `directory`, as dataset paths relative to the images folder. */
function listImagePaths(directory: Directory, rootUri: string): readonly DatasetImagePath[] {
  return directory.list().flatMap((entry) => {
    if (entry instanceof Directory) return listImagePaths(entry, rootUri);
    if (entry.uri.endsWith(PARTIAL_DOWNLOAD_SUFFIX)) return [];
    const parsed = parseDatasetImagePath(entry.uri.slice(rootUri.length + 1));
    return parsed.ok ? [parsed.value] : [];
  });
}

function failure(
  cancelled: boolean,
  cause: unknown,
  cleanupFailure: string | undefined,
): DownloadResult {
  if (cancelled) {
    return err(domainError('exercises.imageDownloadCancelled', 'The download was cancelled.'));
  }
  const details = { cause: describeCause(cause) };
  return err(
    domainError(
      'exercises.imageDownloadFailed',
      'The image could not be downloaded.',
      cleanupFailure === undefined ? details : { ...details, cleanupFailure },
    ),
  );
}
