import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { useDependency } from '@core/presentation';

import type { ExerciseLibraryError } from '../application/library-errors';
import {
  OfflineImagesToken,
  type OfflineImagesEstimate,
  type OfflineImagesState,
} from '../application/offline-images';

import { useResultLoader, type LoadState } from './use-result-loader';

export interface OfflineImagesViewModel {
  /** The shared run (one per app process), also when it was started on an earlier visit. */
  readonly run: OfflineImagesState;
  /** What "Download all images" would fetch now. */
  readonly estimate: LoadState<OfflineImagesEstimate, ExerciseLibraryError>;
  readonly reloadEstimate: () => void;
  readonly isConfirming: boolean;
  /** "Download all images": asks first; nothing is downloaded before the user confirms. */
  readonly requestDownload: () => void;
  readonly confirmDownload: () => void;
  readonly dismissConfirmation: () => void;
  readonly cancelDownload: () => void;
  /** "Retry failed": a new run, which fetches only the images that are still missing. */
  readonly retryFailed: () => void;
}

type RunStatus = OfflineImagesState['status'];

const ACTIVE_STATUSES: readonly RunStatus[] = ['preparing', 'running'];

/**
 * View-model hook (MVVM) of the "Offline images" section (S1-28, ADR-004 T8).
 *
 * - Observes the `OfflineImages` singleton with `useSyncExternalStore` (**Observer**), so leaving
 *   and re-opening Settings shows the current run; the service decides every transition.
 * - Loads the estimate on mount and again whenever a run ends, so the section always says what is
 *   still missing (e.g. "All images are available offline" after a complete run).
 * - Never starts a download by itself: only `confirmDownload` and `retryFailed` call `start()`.
 *   A second start while a run is active is ignored by the service (one run at a time).
 */
export function useOfflineImages(): OfflineImagesViewModel {
  const service = useDependency(OfflineImagesToken);
  const subscribe = useCallback((onChange: () => void) => service.subscribe(onChange), [service]);
  const getState = useCallback(() => service.getState(), [service]);
  const run = useSyncExternalStore(subscribe, getState);
  const loadEstimate = useCallback(() => service.estimate(), [service]);
  const { state: estimate, reload: reloadEstimate } = useResultLoader(loadEstimate);
  const [isConfirming, setConfirming] = useState(false);

  useReloadWhenRunEnds(run.status, reloadEstimate);

  const requestDownload = useCallback(() => setConfirming(true), []);
  const dismissConfirmation = useCallback(() => setConfirming(false), []);
  const confirmDownload = useCallback(() => {
    setConfirming(false);
    service.start();
  }, [service]);
  const cancelDownload = useCallback(() => service.cancel(), [service]);
  const retryFailed = useCallback(() => service.start(), [service]);

  return {
    run,
    estimate,
    reloadEstimate,
    isConfirming,
    requestDownload,
    confirmDownload,
    dismissConfirmation,
    cancelDownload,
    retryFailed,
  };
}

/** Calls `reload` when the run goes from active (preparing/running) to ended. */
function useReloadWhenRunEnds(status: RunStatus, reload: () => void): void {
  const previous = useRef(status);
  useEffect(() => {
    const wasActive = ACTIVE_STATUSES.includes(previous.current);
    previous.current = status;
    if (wasActive && !ACTIVE_STATUSES.includes(status)) {
      reload();
    }
  }, [status, reload]);
}
