import type { DatasetImagePath } from '../domain/exercise';

import type { BuiltInImageCache, ImageDownloadTask } from './built-in-image-cache';

/**
 * **Decorator** around the real `BuiltInImageCache` (ADR-004 §5, S1-18, S1-28): concurrent
 * `download(path)` calls share one in-flight task until it settles, so the list/detail and the
 * bulk download never fetch the same image twice. Cancelling the shared task cancels it for every
 * caller (the on-demand view then shows the placeholder and retries next time). `localUri` and
 * `cachedPaths` delegate. One instance per container (singleton), registered around the adapter.
 */
export class SingleFlightImageCache implements BuiltInImageCache {
  private readonly inFlight = new Map<DatasetImagePath, ImageDownloadTask>();

  constructor(private readonly inner: BuiltInImageCache) {}

  localUri(path: DatasetImagePath): Promise<string | null> {
    return this.inner.localUri(path);
  }

  cachedPaths(): Promise<ReadonlySet<DatasetImagePath>> {
    return this.inner.cachedPaths();
  }

  download(path: DatasetImagePath): ImageDownloadTask {
    const shared = this.inFlight.get(path);
    if (shared !== undefined) return shared;
    const task = this.inner.download(path);
    this.inFlight.set(path, task);
    void task.result.then(() => this.inFlight.delete(path));
    return task;
  }
}
