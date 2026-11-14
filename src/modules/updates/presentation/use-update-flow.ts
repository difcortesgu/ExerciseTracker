import { useCallback, useEffect, useReducer, useRef } from 'react';

import { useDependency } from '@core/presentation';

import type { Release } from '../domain/release';
import type { DownloadedApk, DownloadTask } from '../application/apk-downloader';
import { CheckForUpdateToken } from '../application/check-for-update';
import { DownloadUpdateToken } from '../application/download-update';
import { InstallUpdateToken } from '../application/install-update';
import { UpdateOfferDismissalToken } from '../application/update-offer-dismissal';

import {
  initialUpdateFlowState,
  updateFlowReducer,
  type UpdateFlowEvent,
  type UpdateFlowState,
} from './update-flow-machine';

export interface UpdateFlow {
  readonly state: UpdateFlowState;
  /** Update on the offer: start downloading the offered release. */
  readonly update: (release: Release) => void;
  /** Retry after a failed download or installer hand-off: download again from zero. */
  readonly retry: (release: Release) => void;
  /** Continue from the install note: open Android's installer for the downloaded APK. */
  readonly openInstaller: (apk: DownloadedApk) => void;
  /** Later / Cancel download / Close / Not now / Android back: hide for the rest of the launch. */
  readonly dismiss: () => void;
}

/**
 * View-model hook (MVVM) of the self-update prompt (S05-08 to S05-10). Orchestrates the use cases
 * from the DI container; every state decision is made by `updateFlowReducer`.
 *
 * - Runs the update check once per mount without blocking anything (the use case itself is
 *   memoized per launch); only an `updateAvailable` outcome leads to the offer.
 * - Reaching `dismissed` is recorded in the process-scoped `UpdateOfferDismissal` store, and a
 *   remount starts from it, so a dismissed offer stays hidden for the whole launch (QA-05-1).
 * - Each action is offered by the view only in its own state and receives that state's data.
 *   Refs track the running download and an open installer, so a fast double tap (two taps
 *   before React re-renders) never starts a second download or installer.
 * - Cancel, dismissing and unmounting stop the running download; its late result reaches the
 *   reducer, which ignores it.
 */
export function useUpdateFlow(): UpdateFlow {
  const checkForUpdate = useDependency(CheckForUpdateToken);
  const downloadUpdate = useDependency(DownloadUpdateToken);
  const installUpdate = useDependency(InstallUpdateToken);
  const dismissal = useDependency(UpdateOfferDismissalToken);
  const [state, dispatch] = useReducer(updateFlowReducer, undefined, () =>
    initialUpdateFlowState({ dismissedThisLaunch: dismissal.isDismissed() }),
  );
  const runningDownload = useRef<DownloadTask | null>(null);
  const installerOpen = useRef(false);

  useEffect(() => {
    void checkForUpdate().then((outcome) => {
      if (outcome.kind === 'updateAvailable') {
        dispatch({ type: 'offerReceived', release: outcome.release });
      }
    });
  }, [checkForUpdate]);

  useEffect(() => () => runningDownload.current?.cancel(), []);

  useEffect(() => {
    if (state.kind === 'dismissed') {
      dismissal.dismiss();
    }
  }, [state.kind, dismissal]);

  const startDownload = useCallback(
    (release: Release, event: UpdateFlowEvent) => {
      if (runningDownload.current !== null) {
        return;
      }
      dispatch(event);
      const task = downloadUpdate(release, (progress) =>
        dispatch({ type: 'progressed', progress }),
      );
      runningDownload.current = task;
      void task.result.then((result) => {
        runningDownload.current = null;
        dispatch(
          result.ok
            ? { type: 'downloadSucceeded', apk: result.value }
            : { type: 'failed', error: result.error },
        );
      });
    },
    [downloadUpdate],
  );

  const update = useCallback(
    (release: Release) => startDownload(release, { type: 'updateRequested' }),
    [startDownload],
  );

  const retry = useCallback(
    (release: Release) => startDownload(release, { type: 'retryRequested' }),
    [startDownload],
  );

  const openInstaller = useCallback(
    (apk: DownloadedApk) => {
      if (installerOpen.current) {
        return;
      }
      installerOpen.current = true;
      dispatch({ type: 'installConfirmed' });
      void installUpdate(apk).then((result) => {
        installerOpen.current = false;
        dispatch(
          result.ok ? { type: 'installerReturned' } : { type: 'failed', error: result.error },
        );
      });
    },
    [installUpdate],
  );

  const dismiss = useCallback(() => {
    runningDownload.current?.cancel();
    dispatch({ type: 'dismissed' });
  }, []);

  return { state, update, retry, openInstaller, dismiss };
}
