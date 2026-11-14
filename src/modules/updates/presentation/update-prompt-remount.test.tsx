import { render, screen } from '@testing-library/react-native';

import { createContainer, type Container } from '@core/di/container';
import { ok } from '@shared/domain/result';
import { aReleaseInstall } from '@test/builders/installed-app.builder';
import { aPublishedRelease } from '@test/builders/release.builder';
import { FakeInstalledAppInfo } from '@test/fakes/fake-installed-app-info';
import { FakeReleaseSource } from '@test/fakes/fake-release-source';
import { RecordingLogger } from '@test/fakes/recording-logger';
import {
  MEBIBYTE,
  OFFER_TITLE,
  offerDialog,
  press,
  promptTree,
} from '@test/support/update-prompt-harness';

import { CheckForUpdateToken, createCheckForUpdate } from '../application/check-for-update';
import { DownloadUpdateToken, type DownloadUpdate } from '../application/download-update';
import { InstallUpdateToken, type InstallUpdate } from '../application/install-update';
import {
  createUpdateOfferDismissal,
  UpdateOfferDismissalToken,
} from '../application/update-offer-dismissal';

const downloadNever: DownloadUpdate = () => ({
  result: new Promise(() => undefined),
  cancel: () => undefined,
});
const installNever: InstallUpdate = () => Promise.resolve(ok(undefined));

/**
 * One JS process (one launch): a container with the **real** memoized check use case and the real
 * dismissal store, both singletons as in the composition root, so they outlive any remount.
 */
function aLaunch(): Container {
  const releaseSource = new FakeReleaseSource();
  releaseSource.respondWith(
    aPublishedRelease()
      .forBuild(42)
      .withApk({ sizeBytes: 35 * MEBIBYTE })
      .build(),
  );
  const logger = new RecordingLogger();
  return createContainer()
    .register(CheckForUpdateToken, () =>
      createCheckForUpdate({
        installedAppInfo: new FakeInstalledAppInfo(aReleaseInstall().withBuildNumber(41).build()),
        releaseSource,
        logger,
      }),
    )
    .register(DownloadUpdateToken, () => downloadNever)
    .register(InstallUpdateToken, () => installNever)
    .register(UpdateOfferDismissalToken, () => createUpdateOfferDismissal());
}

/** Mounts the root shell (tabs + prompt), like `app/_layout.tsx` does when the activity starts. */
const mountRoot = (launch: Container) => render(promptTree(launch));

/** Lets the (already settled) memoized check reach the view model. */
const settleCheck = () => screen.findByText('Tabs');

describe('UpdatePrompt remounted in the same process (QA-05-1, S05-08)', () => {
  it('stays hidden after Later when the root layout remounts in the same launch', async () => {
    const launch = aLaunch();
    const first = await mountRoot(launch);
    await screen.findByRole('header', { name: OFFER_TITLE });
    await press('Later');
    await first.unmount();

    // Android 11 and older: Back on the root tab finishes the activity, the JS runtime survives.
    await mountRoot(launch);
    await settleCheck();

    expect(screen.getByText('Tabs')).toBeOnTheScreen();
    expect(offerDialog()).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Later' })).not.toBeOnTheScreen();
  });

  it('stays hidden after cancelling the download when the root layout remounts', async () => {
    const launch = aLaunch();
    const first = await mountRoot(launch);
    await screen.findByRole('header', { name: OFFER_TITLE });
    await press('Update');
    await press('Cancel download');
    await first.unmount();

    await mountRoot(launch);
    await settleCheck();

    expect(offerDialog()).not.toBeOnTheScreen();
  });

  it('offers the update again on the next launch (a new process, a new container)', async () => {
    const first = await mountRoot(aLaunch());
    await screen.findByRole('header', { name: OFFER_TITLE });
    await press('Later');
    await first.unmount();

    await mountRoot(aLaunch());

    expect(await screen.findByRole('header', { name: OFFER_TITLE })).toBeOnTheScreen();
  });

  it('still offers after a remount when the user never answered the offer', async () => {
    const launch = aLaunch();
    const first = await mountRoot(launch);
    await screen.findByRole('header', { name: OFFER_TITLE });
    await first.unmount();

    await mountRoot(launch);

    expect(await screen.findByRole('header', { name: OFFER_TITLE })).toBeOnTheScreen();
  });
});
