import type { Logger } from '@shared/application/logger';

import type { BuiltInImage } from '../domain/exercise';

import type { ImageDownloadTask } from './built-in-image-cache';
import { listMissingImages, type MissingImagesDependencies } from './missing-images';
import type { OfflineImagesState } from './offline-images';

export interface OfflineImagesRunOptions extends MissingImagesDependencies {
  readonly logger: Logger;
  readonly concurrency: number;
  readonly consecutiveFailuresToStop: number;
  /** Receives every state of this run (the service ignores a superseded run). */
  readonly onState: (state: OfflineImagesState) => void;
}

/**
 * One "Download all images" run (S1-28): `preparing` → `running` → `finished` | `cancelled`.
 * A worker pool of `concurrency` downloads through the shared cache; `consecutiveFailuresToStop`
 * failures in a row end the run early; `cancel()` stops promptly and cancels in-flight tasks.
 */
export class OfflineImagesRun {
  private readonly inFlight = new Set<ImageDownloadTask>();
  private phase: 'preparing' | 'running' | 'stopping' | 'cancelled' | 'finished' = 'preparing';
  private queue: readonly BuiltInImage[] = [];
  private completed = 0;
  private failed = 0;
  private consecutiveFailures = 0;

  constructor(private readonly options: OfflineImagesRunOptions) {}

  async execute(): Promise<void> {
    this.options.onState({ status: 'preparing' });
    const missing = await listMissingImages(this.options);
    if (!missing.ok) {
      this.options.logger.error('The offline image download could not start.', {
        code: missing.error.code,
        details: missing.error.details,
      });
      this.end({ status: 'finished', succeeded: 0, failed: 0, stoppedEarly: false });
      return;
    }
    this.queue = missing.value.images;
    if (this.phase === 'cancelled') {
      this.options.onState({ status: 'cancelled', succeeded: 0, remaining: this.queue.length });
      return;
    }
    this.phase = 'running';
    this.reportProgress();
    // One iterator shared by every worker: each image is taken exactly once.
    const pending = this.queue.values();
    const workers = Array.from({ length: this.options.concurrency }, () => this.work(pending));
    await Promise.all(workers);
    this.finish();
  }

  cancel(): void {
    if (this.phase === 'preparing') {
      this.phase = 'cancelled';
      return;
    }
    if (this.phase !== 'running') return;
    this.phase = 'cancelled';
    this.cancelInFlight();
    const remaining = this.queue.length - this.completed;
    this.options.onState({ status: 'cancelled', succeeded: this.completed, remaining });
  }

  private async work(pending: Iterator<BuiltInImage>): Promise<void> {
    for (let next = pending.next(); this.phase === 'running' && next.done !== true;) {
      await this.download(next.value);
      next = pending.next();
    }
  }

  private async download({ path }: BuiltInImage): Promise<void> {
    const task = this.options.imageCache.download(path);
    this.inFlight.add(task);
    const outcome = await task.result;
    this.inFlight.delete(task);
    if (this.phase === 'cancelled') return;
    if (outcome.ok) {
      this.completed += 1;
      this.consecutiveFailures = 0;
    } else {
      if (this.phase === 'stopping') return;
      this.failed += 1;
      this.consecutiveFailures += 1;
      this.options.logger.warn('An exercise image could not be downloaded.', {
        code: outcome.error.code,
        details: outcome.error.details,
        path,
      });
      if (this.consecutiveFailures >= this.options.consecutiveFailuresToStop) this.stopEarly();
    }
    if (this.phase === 'running') this.reportProgress();
  }

  /** The connection seems lost: no new downloads, in-flight ones are cancelled. */
  private stopEarly(): void {
    this.phase = 'stopping';
    this.cancelInFlight();
  }

  private cancelInFlight(): void {
    [...this.inFlight].forEach((task) => task.cancel());
  }

  private reportProgress(): void {
    const { completed, failed } = this;
    this.options.onState({ status: 'running', completed, failed, total: this.queue.length });
  }

  private finish(): void {
    if (this.phase === 'cancelled') return;
    const stoppedEarly = this.phase === 'stopping';
    // When stopped early, images never attempted count as failed ("Retry failed" fetches them).
    const failed = stoppedEarly ? this.queue.length - this.completed : this.failed;
    this.end({ status: 'finished', succeeded: this.completed, failed, stoppedEarly });
  }

  private end(state: OfflineImagesState): void {
    this.phase = 'finished';
    this.options.onState(state);
  }
}
