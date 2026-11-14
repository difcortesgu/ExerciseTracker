import { domainError } from '@shared/domain/domain-error';
import { aRelease } from '@test/builders/release.builder';

import type { DownloadedApk } from '../application/apk-downloader';

import {
  INITIAL_UPDATE_FLOW_STATE,
  initialUpdateFlowState,
  updateFlowReducer,
  type UpdateFlowEvent,
  type UpdateFlowState,
} from './update-flow-machine';

const release = aRelease().forBuild(42).build();
const apk: DownloadedApk = { fileUri: 'file:///cache/updates/update.apk', sizeBytes: 31_457_280 };
const startProgress = { receivedBytes: 0, totalBytes: release.apk.sizeBytes };
const halfway = { receivedBytes: 15_728_640, totalBytes: release.apk.sizeBytes };
const downloadFailed = domainError('updates.downloadFailed', 'Network lost.');
const installerUnavailable = domainError('updates.installerUnavailable', 'No activity.');

const offered: UpdateFlowState = { kind: 'offered', release };
const downloading: UpdateFlowState = { kind: 'downloading', release, progress: halfway };
const failed: UpdateFlowState = { kind: 'failed', release, error: downloadFailed };
const installNote: UpdateFlowState = { kind: 'installNote', release, apk };
const installing: UpdateFlowState = { kind: 'installing', release, apk };
const dismissed: UpdateFlowState = { kind: 'dismissed' };

const run = (state: UpdateFlowState, ...events: readonly UpdateFlowEvent[]): UpdateFlowState =>
  events.reduce(updateFlowReducer, state);

describe('updateFlowReducer (update prompt state machine)', () => {
  it('starts idle: nothing is shown while the check runs', () => {
    expect(INITIAL_UPDATE_FLOW_STATE).toEqual({ kind: 'idle' });
  });

  it('starts idle when the offer was not dismissed earlier in this launch', () => {
    expect(initialUpdateFlowState({ dismissedThisLaunch: false })).toBe(INITIAL_UPDATE_FLOW_STATE);
  });

  it('starts dismissed after a remount when the offer was already dismissed (QA-05-1)', () => {
    const state = initialUpdateFlowState({ dismissedThisLaunch: true });

    expect(state).toEqual(dismissed);
    expect(run(state, { type: 'offerReceived', release })).toEqual(dismissed);
  });

  it('offers the release when the check finds one', () => {
    expect(run(INITIAL_UPDATE_FLOW_STATE, { type: 'offerReceived', release })).toEqual(offered);
  });

  it('starts downloading from zero when the user taps Update', () => {
    expect(run(offered, { type: 'updateRequested' })).toEqual({
      kind: 'downloading',
      release,
      progress: startProgress,
    });
  });

  it('follows the download progress as data arrives', () => {
    expect(
      run(offered, { type: 'updateRequested' }, { type: 'progressed', progress: halfway }),
    ).toEqual(downloading);
  });

  it('shows the install note once the download completes', () => {
    expect(run(downloading, { type: 'downloadSucceeded', apk })).toEqual(installNote);
  });

  it('shows the failure with its error when the download fails', () => {
    expect(run(downloading, { type: 'failed', error: downloadFailed })).toEqual(failed);
  });

  it('downloads again from zero when the user retries a failure', () => {
    expect(run(failed, { type: 'retryRequested' })).toEqual({
      kind: 'downloading',
      release,
      progress: startProgress,
    });
  });

  it('opens the installer when the user continues from the note', () => {
    expect(run(installNote, { type: 'installConfirmed' })).toEqual(installing);
  });

  it('shows the failure when the installer cannot be opened', () => {
    expect(run(installing, { type: 'failed', error: installerUnavailable })).toEqual({
      kind: 'failed',
      release,
      error: installerUnavailable,
    });
  });

  it('returns to normal use when the user comes back from the installer', () => {
    expect(run(installing, { type: 'installerReturned' })).toEqual(dismissed);
  });

  it.each<[string, UpdateFlowState]>([
    ['the offer (Later)', offered],
    ['a running download (Cancel)', downloading],
    ['a failure (Close)', failed],
    ['the install note (Not now)', installNote],
  ])('is dismissed for the rest of the launch from %s', (_name, state) => {
    expect(run(state, { type: 'dismissed' })).toEqual(dismissed);
  });

  it('never offers again once dismissed in this launch', () => {
    expect(run(dismissed, { type: 'offerReceived', release })).toEqual(dismissed);
  });

  describe('ignores events that do not apply to the current state', () => {
    it.each<[string, UpdateFlowState, UpdateFlowEvent]>([
      ['late progress after a cancel', dismissed, { type: 'progressed', progress: halfway }],
      ['a late download result after a cancel', dismissed, { type: 'downloadSucceeded', apk }],
      ['a late failure after a cancel', dismissed, { type: 'failed', error: downloadFailed }],
      ['Update while nothing is offered', INITIAL_UPDATE_FLOW_STATE, { type: 'updateRequested' }],
      ['a second offer while downloading', downloading, { type: 'offerReceived', release }],
      ['Retry without a failure', offered, { type: 'retryRequested' }],
      ['continuing without a downloaded APK', downloading, { type: 'installConfirmed' }],
      ['an installer return before opening it', installNote, { type: 'installerReturned' }],
      ['progress before downloading', offered, { type: 'progressed', progress: halfway }],
      ['dismissing while the installer is open', installing, { type: 'dismissed' }],
      ['dismissing while idle', INITIAL_UPDATE_FLOW_STATE, { type: 'dismissed' }],
    ])('%s', (_name, state, event) => {
      expect(updateFlowReducer(state, event)).toBe(state);
    });
  });
});
