import type { Release } from '../domain/release';
import type { DownloadedApk, DownloadError, DownloadProgress } from '../application/apk-downloader';
import type { InstallerError } from '../application/apk-installer';

/**
 * State machine of the update prompt (State pattern as a discriminated union + reducer,
 * S05-08 to S05-10):
 *
 * idle ─offerReceived→ offered ─updateRequested→ downloading ─downloadSucceeded→ installNote
 *   installNote ─installConfirmed→ installing ─installerReturned→ dismissed
 *   downloading | installing ─failed→ failed ─retryRequested→ downloading (from zero)
 *   offered | downloading | failed | installNote ─dismissed→ dismissed (Later / Cancel / Close)
 *
 * `dismissed` is final for the launch. A remount in the same process starts in `dismissed` again
 * (`initialUpdateFlowState`, QA-05-1); "Later" is not persisted, so the next launch offers again.
 * Events that do not apply to the current state (e.g. late progress after a cancel) are ignored
 * and return the same state object.
 */

export type UpdateFailure = DownloadError | InstallerError;

export type UpdateFlowState =
  /** Checking, or nothing to offer: the prompt is hidden. */
  | { readonly kind: 'idle' }
  | { readonly kind: 'offered'; readonly release: Release }
  | {
      readonly kind: 'downloading';
      readonly release: Release;
      readonly progress: DownloadProgress;
    }
  | { readonly kind: 'failed'; readonly release: Release; readonly error: UpdateFailure }
  | { readonly kind: 'installNote'; readonly release: Release; readonly apk: DownloadedApk }
  | { readonly kind: 'installing'; readonly release: Release; readonly apk: DownloadedApk }
  /** Later, cancel, close or back from the installer: hidden for the rest of this launch. */
  | { readonly kind: 'dismissed' };

export type UpdateFlowEvent =
  | { readonly type: 'offerReceived'; readonly release: Release }
  | { readonly type: 'updateRequested' }
  | { readonly type: 'progressed'; readonly progress: DownloadProgress }
  | { readonly type: 'downloadSucceeded'; readonly apk: DownloadedApk }
  | { readonly type: 'failed'; readonly error: UpdateFailure }
  | { readonly type: 'retryRequested' }
  | { readonly type: 'installConfirmed' }
  | { readonly type: 'installerReturned' }
  | { readonly type: 'dismissed' };

export const INITIAL_UPDATE_FLOW_STATE: UpdateFlowState = Object.freeze({ kind: 'idle' });

const DISMISSED: UpdateFlowState = Object.freeze({ kind: 'dismissed' });

/**
 * Where the machine starts when the prompt mounts: `dismissed` if the offer was already turned down
 * earlier in this launch (the prompt was remounted), otherwise `idle`.
 */
export function initialUpdateFlowState(launch: {
  readonly dismissedThisLaunch: boolean;
}): UpdateFlowState {
  return launch.dismissedThisLaunch ? DISMISSED : INITIAL_UPDATE_FLOW_STATE;
}

const DISMISSIBLE_STATES: ReadonlySet<UpdateFlowState['kind']> = new Set([
  'offered',
  'downloading',
  'failed',
  'installNote',
]);

const startDownload = (release: Release): UpdateFlowState => ({
  kind: 'downloading',
  release,
  progress: { receivedBytes: 0, totalBytes: release.apk.sizeBytes },
});

/**
 * Reducer of the update prompt state machine (pure; usable with `useReducer`). The one exhaustive
 * `switch` over the event union, inside the machine's own file (ENGINEERING_STANDARDS §2 "O").
 */
export function updateFlowReducer(state: UpdateFlowState, event: UpdateFlowEvent): UpdateFlowState {
  switch (event.type) {
    case 'offerReceived':
      return state.kind === 'idle' ? { kind: 'offered', release: event.release } : state;
    case 'updateRequested':
      return state.kind === 'offered' ? startDownload(state.release) : state;
    case 'progressed':
      return state.kind === 'downloading' ? { ...state, progress: event.progress } : state;
    case 'downloadSucceeded':
      return state.kind === 'downloading'
        ? { kind: 'installNote', release: state.release, apk: event.apk }
        : state;
    case 'failed':
      return state.kind === 'downloading' || state.kind === 'installing'
        ? { kind: 'failed', release: state.release, error: event.error }
        : state;
    case 'retryRequested':
      return state.kind === 'failed' ? startDownload(state.release) : state;
    case 'installConfirmed':
      return state.kind === 'installNote' ? { ...state, kind: 'installing' } : state;
    case 'installerReturned':
      return state.kind === 'installing' ? DISMISSED : state;
    case 'dismissed':
      return DISMISSIBLE_STATES.has(state.kind) ? DISMISSED : state;
  }
}
