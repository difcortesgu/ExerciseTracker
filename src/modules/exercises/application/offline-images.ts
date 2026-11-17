import { createToken } from '@shared/application/di/token';
import type { Logger } from '@shared/application/logger';
import type { Result } from '@shared/domain/result';

import type { BuiltInImageCache } from './built-in-image-cache';
import type { EnsureLibrarySeeded } from './ensure-library-seeded';
import type { BuiltInImageCatalog } from './exercise-repository';
import type { ExerciseLibraryError } from './library-errors';
import { logged } from './library-use-case-support';
import { listMissingImages } from './missing-images';
import { OfflineImagesRun } from './offline-images-run';

/** What "Download all images" would fetch (S1-28 confirmation). */
export interface OfflineImagesEstimate {
  /** Images of active built-ins that are not cached yet; 0 → "All images are available offline". */
  readonly missingCount: number;
  /** Exact sum of their sizes from the seed metadata; shown as "about … MB". */
  readonly missingBytes: number;
  readonly totalCount: number;
}

/** State of the bulk download, observed by the Settings section (S1-28). */
export type OfflineImagesState =
  | { readonly status: 'idle' }
  /** Listing the missing images after `start()`. */
  | { readonly status: 'preparing' }
  | {
      readonly status: 'running';
      readonly completed: number;
      readonly failed: number;
      readonly total: number;
    }
  /**
   * The run ended. `failed` includes images not attempted when the run stopped early
   * (`stoppedEarly`: the connection seems lost). `failed > 0` → offer "Retry failed" (= `start()`).
   */
  | {
      readonly status: 'finished';
      readonly succeeded: number;
      readonly failed: number;
      readonly stoppedEarly: boolean;
    }
  | { readonly status: 'cancelled'; readonly succeeded: number; readonly remaining: number };

/**
 * Service: the user-triggered "Download all images for offline use" (S1-28, ADR-004 T8).
 * **Observer** (`subscribe`) + explicit state machine; one instance per container (singleton), so
 * a run continues while the user leaves the screen, and coming back shows its current state.
 *
 * - Never starts by itself. `start()` lists the missing images (`BuiltInImageCatalog` minus
 *   `BuiltInImageCache.cachedPaths()`) and downloads them through the shared single-flight cache
 *   with at most `OFFLINE_IMAGES_CONCURRENCY = 4` at a time. Cached images are skipped, so a second
 *   run right after the first downloads nothing (idempotent). `start()` while `preparing` or
 *   `running` is a no-op (one run at a time).
 * - `cancel()` stops promptly: no new downloads, in-flight tasks are cancelled; finished images
 *   stay cached, partial files never become visible.
 * - Each failure is logged with its code. After `CONSECUTIVE_FAILURES_TO_STOP = 5` failures in a
 *   row the run ends with `stoppedEarly: true` instead of retrying forever.
 * - Background: no background task (Expo Go). The run lives as long as the JS process; if Android
 *   suspends or kills the app, downloaded images are kept and the user starts the download again
 *   (only the missing ones are fetched). The UI says so.
 * - `subscribe` returns an unsubscribe function; listeners get every new state, never the same
 *   state twice in a row. Suitable for React's `useSyncExternalStore` (`getState` is stable
 *   between changes).
 *
 * Phase 2: `createOfflineImages(deps: { ensureLibrarySeeded; catalog: BuiltInImageCatalog;
 * imageCache: BuiltInImageCache; logger })`.
 */
export interface OfflineImages {
  estimate(): Promise<Result<OfflineImagesEstimate, ExerciseLibraryError>>;
  start(): void;
  cancel(): void;
  getState(): OfflineImagesState;
  subscribe(listener: (state: OfflineImagesState) => void): () => void;
}

export const OfflineImagesToken = createToken<OfflineImages>('exercises.OfflineImages');

/** Downloads running at the same time (ADR-004 T8). */
export const OFFLINE_IMAGES_CONCURRENCY = 4;

/** Failures in a row after which the run ends early: the connection seems lost (ADR-004 T8). */
export const CONSECUTIVE_FAILURES_TO_STOP = 5;

export interface OfflineImagesDependencies {
  readonly ensureLibrarySeeded: EnsureLibrarySeeded;
  readonly catalog: BuiltInImageCatalog;
  /** The shared single-flight cache (`SingleFlightImageCache`), the same as on-demand images. */
  readonly imageCache: BuiltInImageCache;
  readonly logger: Logger;
}

const IDLE: OfflineImagesState = Object.freeze({ status: 'idle' });

/** **Observer** + state machine of the bulk download (see `OfflineImages`). */
class OfflineImagesService implements OfflineImages {
  private state: OfflineImagesState = IDLE;
  private readonly listeners = new Set<(state: OfflineImagesState) => void>();
  private run: OfflineImagesRun | null = null;

  constructor(private readonly deps: OfflineImagesDependencies) {}

  async estimate(): Promise<Result<OfflineImagesEstimate, ExerciseLibraryError>> {
    const missing = logged(
      this.deps.logger,
      'The offline images could not be estimated.',
      await listMissingImages(this.deps),
    );
    if (!missing.ok) return missing;
    const { images, totalCount } = missing.value;
    return {
      ok: true,
      value: Object.freeze({
        missingCount: images.length,
        missingBytes: images.reduce((sum, { sizeBytes }) => sum + sizeBytes, 0),
        totalCount,
      }),
    };
  }

  start(): void {
    if (this.state.status === 'preparing' || this.state.status === 'running') return;
    const run = new OfflineImagesRun({
      ...this.deps,
      concurrency: OFFLINE_IMAGES_CONCURRENCY,
      consecutiveFailuresToStop: CONSECUTIVE_FAILURES_TO_STOP,
      // A run never reports after its terminal state, so the current run owns the state.
      onState: (state) => this.setState(state),
    });
    this.run = run;
    void run.execute();
  }

  cancel(): void {
    this.run?.cancel();
  }

  getState(): OfflineImagesState {
    return this.state;
  }

  subscribe(listener: (state: OfflineImagesState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Every state a run reports differs from the previous one (contract: never the same twice). */
  private setState(next: OfflineImagesState): void {
    this.state = Object.freeze(next);
    this.listeners.forEach((listener) => listener(this.state));
  }
}

/** The bulk-download service; register **one** per container (singleton). */
export function createOfflineImages(deps: OfflineImagesDependencies): OfflineImages {
  return new OfflineImagesService(deps);
}
