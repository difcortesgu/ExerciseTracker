import type { InstalledApp } from '@shared/domain/installed-app';
import type { ReleaseSource } from '@modules/updates/application/release-source';
import { aDevelopmentInstall, aReleaseInstall } from '@test/builders/installed-app.builder';
import { aPublishedRelease, aRelease } from '@test/builders/release.builder';
import { FakeInstalledAppInfo } from '@test/fakes/fake-installed-app-info';
import { FakeReleaseSource } from '@test/fakes/fake-release-source';
import { RecordingLogger } from '@test/fakes/recording-logger';

import { createCheckForUpdate } from './check-for-update';

function setUp(installed: InstalledApp = aReleaseInstall().withBuildNumber(42).build()) {
  const releaseSource = new FakeReleaseSource();
  const logger = new RecordingLogger();
  const checkForUpdate = createCheckForUpdate({
    installedAppInfo: new FakeInstalledAppInfo(installed),
    releaseSource,
    logger,
  });
  return { checkForUpdate, releaseSource, logger };
}

describe('createCheckForUpdate', () => {
  describe('in a release build', () => {
    it('offers a strictly newer release', async () => {
      const { checkForUpdate, releaseSource } = setUp();
      releaseSource.respondWith(aPublishedRelease().forBuild(43).build());

      const outcome = await checkForUpdate();

      expect(outcome).toEqual({
        kind: 'updateAvailable',
        release: aRelease().forBuild(43).build(),
      });
    });

    it.each([42, 41])('reports up to date when the latest release is build %d', async (latest) => {
      const { checkForUpdate, releaseSource, logger } = setUp();
      releaseSource.respondWith(aPublishedRelease().forBuild(latest).build());

      const outcome = await checkForUpdate();

      expect(outcome).toEqual({ kind: 'upToDate', installed: 42 });
      expect(logger.entries).toEqual([]);
    });
  });

  describe('when the release source fails', () => {
    it.each([
      'updates.noPublishedRelease',
      'updates.rateLimited',
      'updates.httpError',
      'updates.networkUnavailable',
      'updates.timeout',
      'updates.malformedResponse',
    ] as const)('resolves with checkFailed and logs %s as a warning', async (code) => {
      const { checkForUpdate, releaseSource, logger } = setUp();
      releaseSource.failWith(code);

      const outcome = await checkForUpdate();

      expect(outcome).toMatchObject({ kind: 'checkFailed', error: { code } });
      expect(logger.entriesAt('warn')).toEqual([
        expect.objectContaining({ context: expect.objectContaining({ code }) as unknown }),
      ]);
      expect(logger.entriesAt('error')).toEqual([]);
    });

    it('resolves with a logged checkFailed when the source rejects against its contract', async () => {
      const rejectingSource: ReleaseSource = {
        fetchLatestRelease: () => Promise.reject(new Error('socket hang up')),
      };
      const logger = new RecordingLogger();
      const checkForUpdate = createCheckForUpdate({
        installedAppInfo: new FakeInstalledAppInfo(),
        releaseSource: rejectingSource,
        logger,
      });

      const outcome = await checkForUpdate();

      expect(outcome).toMatchObject({
        kind: 'checkFailed',
        error: { code: 'updates.networkUnavailable', details: { cause: 'socket hang up' } },
      });
      expect(logger.entriesAt('warn')).toHaveLength(1);
    });
  });

  describe('when the latest release is invalid', () => {
    it.each([
      [aPublishedRelease().withTag('v2'), 'updates.invalidBuildNumber'],
      [aPublishedRelease().withAssets(), 'updates.missingApkAsset'],
      [
        aPublishedRelease().withApk({ downloadUrl: 'http://github.com/a.apk' }),
        'updates.insecureDownloadUrl',
      ],
    ] as const)(
      'resolves with checkFailed and logs the release error (%#)',
      async (published, code) => {
        const { checkForUpdate, releaseSource, logger } = setUp();
        releaseSource.respondWith(published.build());

        const outcome = await checkForUpdate();

        expect(outcome).toMatchObject({ kind: 'checkFailed', error: { code } });
        expect(logger.entriesAt('warn')).toEqual([
          expect.objectContaining({ context: expect.objectContaining({ code }) as unknown }),
        ]);
      },
    );
  });

  describe('in Expo Go or a development build', () => {
    it('is inactive without calling the release source or logging an error', async () => {
      const { checkForUpdate, releaseSource, logger } = setUp(aDevelopmentInstall().build());
      releaseSource.respondWith(aPublishedRelease().forBuild(999).build());

      const outcome = await checkForUpdate();

      expect(outcome).toEqual({ kind: 'inactive' });
      expect(releaseSource.requestCount).toBe(0);
      expect(logger.entriesAt('error')).toEqual([]);
      expect(logger.entriesAt('warn')).toEqual([]);
    });
  });

  describe('once per launch', () => {
    it('calls the release source at most once, however often it is asked', async () => {
      const { checkForUpdate, releaseSource } = setUp();
      releaseSource.respondWith(aPublishedRelease().forBuild(43).build());

      const outcomes = await Promise.all([checkForUpdate(), checkForUpdate()]);
      const later = await checkForUpdate();

      expect(releaseSource.requestCount).toBe(1);
      expect(outcomes[1]).toBe(outcomes[0]);
      expect(later).toBe(outcomes[0]);
    });

    it('does not retry a failed check during the same launch', async () => {
      const { checkForUpdate, releaseSource } = setUp();
      releaseSource.failWith('updates.networkUnavailable');

      await checkForUpdate();
      releaseSource.respondWith(aPublishedRelease().forBuild(43).build());
      const second = await checkForUpdate();

      expect(second.kind).toBe('checkFailed');
      expect(releaseSource.requestCount).toBe(1);
    });

    it('starts a fresh check for a new launch (a new use-case instance)', async () => {
      const first = setUp();
      first.releaseSource.respondWith(aPublishedRelease().forBuild(43).build());
      await first.checkForUpdate();

      const second = setUp();
      second.releaseSource.respondWith(aPublishedRelease().forBuild(43).build());
      await second.checkForUpdate();

      expect(second.releaseSource.requestCount).toBe(1);
    });
  });
});
