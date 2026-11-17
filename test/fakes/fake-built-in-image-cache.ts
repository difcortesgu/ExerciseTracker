import type {
  BuiltInImageCache,
  ImageDownloadError,
  ImageDownloadTask,
} from '@modules/exercises/application/built-in-image-cache';
import type { DatasetImagePath } from '@modules/exercises/domain/exercise';
import { domainError } from '@shared/domain/domain-error';
import { err, ok, type Result } from '@shared/domain/result';

type DownloadResult = Result<string, ImageDownloadError>;

const CACHE_DIRECTORY_URI = 'file:///cache/exercise-images';

/**
 * Fake `BuiltInImageCache` (S1-18, S1-28): an in-memory set of cached paths and a scriptable
 * "image server" (deliver, fail all or some paths, hold until released). Records every request.
 * Passes the same contract suite as the expo-file-system adapter.
 */
export class FakeBuiltInImageCache implements BuiltInImageCache {
  readonly requests: DatasetImagePath[] = [];
  private readonly cached: Set<DatasetImagePath>;
  private networkDown = false;
  private failingPaths: ReadonlySet<DatasetImagePath> = new Set();
  private held = false;
  private readonly pending = new Set<() => void>();

  constructor(cached: readonly DatasetImagePath[] = []) {
    this.cached = new Set(cached);
  }

  /** Downloads started and not settled yet. */
  get inFlight(): number {
    return this.pending.size;
  }

  failDownloads(): void {
    this.networkDown = true;
  }

  restoreNetwork(): void {
    this.networkDown = false;
  }

  failPaths(paths: readonly DatasetImagePath[]): void {
    this.failingPaths = new Set(paths);
  }

  holdDownloads(): void {
    this.held = true;
  }

  /** Completes every held download (as the server answers) and stops holding new ones. */
  releaseDownloads(): void {
    this.held = false;
    [...this.pending].forEach((complete) => complete());
  }

  localUri(path: DatasetImagePath): Promise<string | null> {
    return Promise.resolve(this.cached.has(path) ? uriOf(path) : null);
  }

  cachedPaths(): Promise<ReadonlySet<DatasetImagePath>> {
    return Promise.resolve(new Set(this.cached));
  }

  download(path: DatasetImagePath): ImageDownloadTask {
    if (this.cached.has(path))
      return { result: Promise.resolve(ok(uriOf(path))), cancel: () => undefined };
    this.requests.push(path);
    let settle: (outcome: DownloadResult) => void = () => undefined;
    const result = new Promise<DownloadResult>((resolve) => {
      settle = resolve;
    });
    const complete = (): void => {
      this.pending.delete(complete);
      settle(this.serve(path));
    };
    this.pending.add(complete);
    if (!this.held) queueMicrotask(complete);
    return {
      result,
      cancel: () => {
        if (!this.pending.delete(complete)) return;
        settle(err(domainError('exercises.imageDownloadCancelled', 'The download was cancelled.')));
      },
    };
  }

  private serve(path: DatasetImagePath): DownloadResult {
    if (this.networkDown || this.failingPaths.has(path)) {
      return err(
        domainError('exercises.imageDownloadFailed', 'The image could not be downloaded.', {
          cause: 'Network request failed',
        }),
      );
    }
    this.cached.add(path);
    return ok(uriOf(path));
  }
}

function uriOf(path: DatasetImagePath): string {
  return `${CACHE_DIRECTORY_URI}/${path}`;
}
