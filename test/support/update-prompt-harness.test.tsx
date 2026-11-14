import { BootstrapperToken } from '@core/bootstrap/bootstrapper';
import { domainError } from '@shared/domain/domain-error';
import { err, ok } from '@shared/domain/result';

import {
  aPromptContainer,
  checkNeverSettling,
  checkReturning,
  controllableDownloads,
  controllableInstaller,
  downloadedApk,
  offer,
  offeredRelease,
  withSuccessfulStartup,
} from './update-prompt-harness';

const noProgress = () => undefined;

describe('update prompt harness', () => {
  describe('controllableDownloads', () => {
    it('records each download attempt with the release it was started for', () => {
      const downloads = controllableDownloads();

      downloads.downloadUpdate(offeredRelease, noProgress);
      downloads.downloadUpdate(offeredRelease, noProgress);

      expect(downloads.attempts).toHaveLength(2);
      expect(downloads.latest().release).toBe(offeredRelease);
    });

    it('reports progress to the caller and settles with the result the test chooses', async () => {
      const downloads = controllableDownloads();
      const reported: number[] = [];
      const task = downloads.downloadUpdate(offeredRelease, (progress) =>
        reported.push(progress.receivedBytes),
      );

      await downloads.latest().progress({ receivedBytes: 10, totalBytes: 20 });
      await downloads.latest().settle(ok(downloadedApk));

      expect(reported).toEqual([10]);
      await expect(task.result).resolves.toEqual(ok(downloadedApk));
    });

    it('resolves a cancelled download with downloadCancelled and remembers the cancel', async () => {
      const downloads = controllableDownloads();
      const task = downloads.downloadUpdate(offeredRelease, noProgress);

      task.cancel();

      expect(downloads.latest().isCancelled()).toBe(true);
      await expect(task.result).resolves.toMatchObject({
        ok: false,
        error: { code: 'updates.downloadCancelled' },
      });
    });

    it('fails loudly when the test asks for a download that was never started', () => {
      expect(() => controllableDownloads().latest()).toThrow('No download was started.');
    });
  });

  describe('controllableInstaller', () => {
    it('records the opened APK and resolves when the user returns to the app', async () => {
      const installer = controllableInstaller();

      const opening = installer.installUpdate(downloadedApk);
      await installer.returnToApp();

      expect(installer.opened).toEqual([downloadedApk]);
      await expect(opening).resolves.toEqual(ok(undefined));
    });

    it('resolves with the installer error the test chooses', async () => {
      const installer = controllableInstaller();
      const error = domainError('updates.apkMissing', 'File gone.');

      const opening = installer.installUpdate(downloadedApk);
      await installer.fail(error);

      await expect(opening).resolves.toEqual(err(error));
    });
  });

  describe('check stubs', () => {
    it('checkReturning resolves with the given outcome', async () => {
      await expect(checkReturning(offer)()).resolves.toBe(offer);
    });

    it('checkNeverSettling stays pending', async () => {
      const settled = jest.fn();
      void checkNeverSettling().then(settled);

      await Promise.resolve();

      expect(settled).not.toHaveBeenCalled();
    });
  });

  describe('withSuccessfulStartup', () => {
    it('registers a bootstrapper that succeeds', async () => {
      const container = withSuccessfulStartup(aPromptContainer().container);

      await expect(container.resolve(BootstrapperToken)()).resolves.toEqual(ok(undefined));
    });
  });
});
