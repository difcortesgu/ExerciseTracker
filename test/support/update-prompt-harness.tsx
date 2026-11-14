import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Text } from 'react-native';

import { BootstrapperToken } from '@core/bootstrap/bootstrapper';
import { createContainer, type Container } from '@core/di/container';
import { DependencyProvider } from '@core/presentation';
import { domainError } from '@shared/domain/domain-error';
import { err, ok, type Result } from '@shared/domain/result';
import { aRelease } from '@test/builders/release.builder';

import {
  CheckForUpdateToken,
  DownloadUpdateToken,
  InstallUpdateToken,
  UpdateOfferDismissalToken,
  UpdatePrompt,
  type CheckForUpdate,
  type DownloadedApk,
  type DownloadError,
  type DownloadProgress,
  type DownloadUpdate,
  type InstallerError,
  type InstallUpdate,
  type Release,
  type UpdateCheckOutcome,
} from '@modules/updates';
import { createUpdateOfferDismissal } from '@modules/updates/application/update-offer-dismissal';

/**
 * Test harness of the update prompt (S05-08 to S05-10): use-case stubs the test drives step by step
 * and a container wired with them, shared by the `update-prompt*.test.tsx` and
 * `use-update-flow.test.tsx` suites.
 */

export const MEBIBYTE = 1_048_576;
export const offeredRelease = aRelease()
  .forBuild(42)
  .withSize(35 * MEBIBYTE)
  .build();
export const downloadedApk: DownloadedApk = {
  fileUri: 'file:///cache/updates/update.apk',
  sizeBytes: 35 * MEBIBYTE,
};
export const offer: UpdateCheckOutcome = { kind: 'updateAvailable', release: offeredRelease };
export const OFFER_TITLE = 'Build 42 available (35 MB)';

type DownloadResult = Result<DownloadedApk, DownloadError>;

export interface DownloadAttempt {
  readonly release: Release;
  readonly isCancelled: () => boolean;
  readonly progress: (progress: DownloadProgress) => Promise<void>;
  readonly settle: (result: DownloadResult) => Promise<void>;
}

/** `DownloadUpdate` stub whose downloads the test drives (progress, result, cancel). */
export function controllableDownloads() {
  const attempts: DownloadAttempt[] = [];
  const downloadUpdate: DownloadUpdate = (release, onProgress) => {
    let resolve: (result: DownloadResult) => void = () => undefined;
    let cancelled = false;
    const result = new Promise<DownloadResult>((settle) => {
      resolve = settle;
    });
    attempts.push({
      release,
      isCancelled: () => cancelled,
      progress: (progress) => act(async () => onProgress(progress)),
      settle: (outcome) => act(async () => resolve(outcome)),
    });
    return {
      result,
      cancel: () => {
        cancelled = true;
        resolve(err(domainError('updates.downloadCancelled', 'Cancelled.')));
      },
    };
  };
  const latest = (): DownloadAttempt => {
    const attempt = attempts.at(-1);
    if (attempt === undefined) {
      throw new Error('No download was started.');
    }
    return attempt;
  };
  return { downloadUpdate, attempts, latest };
}

/** `InstallUpdate` stub that records the APKs and settles when the test says so. */
export function controllableInstaller() {
  const opened: DownloadedApk[] = [];
  let resolve: (result: Result<void, InstallerError>) => void = () => undefined;
  const installUpdate: InstallUpdate = (apk) => {
    opened.push(apk);
    return new Promise((settle) => {
      resolve = settle;
    });
  };
  return {
    installUpdate,
    opened,
    returnToApp: () => act(async () => resolve(ok(undefined))),
    fail: (error: InstallerError) => act(async () => resolve(err(error))),
  };
}

export const checkReturning =
  (outcome: UpdateCheckOutcome): CheckForUpdate =>
  () =>
    Promise.resolve(outcome);
export const checkNeverSettling: CheckForUpdate = () => new Promise(() => undefined);

/** A container with the prompt's use cases stubbed and a real (per-container) dismissal store. */
export function aPromptContainer(checkForUpdate: CheckForUpdate = checkReturning(offer)) {
  const downloads = controllableDownloads();
  const installer = controllableInstaller();
  const container = createContainer()
    .register(CheckForUpdateToken, () => checkForUpdate)
    .register(DownloadUpdateToken, () => downloads.downloadUpdate)
    .register(InstallUpdateToken, () => installer.installUpdate)
    .register(UpdateOfferDismissalToken, () => createUpdateOfferDismissal());
  return { container, downloads, installer };
}

/** Adds a startup that succeeds at once, for tests that render the prompt inside `AppShell`. */
export function withSuccessfulStartup(container: Container): Container {
  return container.register(BootstrapperToken, () => () => Promise.resolve(ok(undefined)));
}

/** The app as the prompt sees it: some content ("Tabs") with the prompt on top. */
export const promptTree = (container: Container): ReactElement => (
  <DependencyProvider resolver={container}>
    <Text>Tabs</Text>
    <UpdatePrompt />
  </DependencyProvider>
);

export async function renderPrompt(checkForUpdate?: CheckForUpdate) {
  const setup = aPromptContainer(checkForUpdate);
  const view = await render(promptTree(setup.container));
  return { ...setup, view };
}

export const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
export const offerDialog = () => screen.queryByRole('header', { name: OFFER_TITLE });

/** Renders the prompt with an offer and taps Update. */
export async function startDownload() {
  const setup = await renderPrompt();
  await press('Update');
  return setup;
}

/** Renders the prompt, taps Update and lets the download succeed (install note shown). */
export async function completeDownload() {
  const setup = await startDownload();
  await setup.downloads.latest().settle(ok(downloadedApk));
  return setup;
}
