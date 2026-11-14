import type {
  ReleaseSource,
  ReleaseSourceErrorCode,
} from '@modules/updates/application/release-source';
import type { PublishedRelease } from '@modules/updates/domain/release';

import { aPublishedRelease } from '../builders/release.builder';

import { defineContract } from './contract-harness';

/**
 * Failures every implementation can be arranged into. `updates.timeout` needs a clock, so it is
 * covered by the GitHub adapter's own tests with fake timers.
 */
export type ArrangeableReleaseSourceFailure = Exclude<ReleaseSourceErrorCode, 'updates.timeout'>;

/** A release source plus a way to arrange what "GitHub" answers next. */
export interface ReleaseSourceFixture {
  readonly source: ReleaseSource;
  givenLatestRelease(release: PublishedRelease): void;
  givenFailure(code: ArrangeableReleaseSourceFailure): void;
  /** How many requests reached "GitHub" so far. */
  requestCount(): number;
}

const ARRANGEABLE_FAILURES: readonly ArrangeableReleaseSourceFailure[] = [
  'updates.noPublishedRelease',
  'updates.rateLimited',
  'updates.httpError',
  'updates.networkUnavailable',
  'updates.malformedResponse',
];

/** Contract every `ReleaseSource` implementation must honour (Sprint 0.5, S05-07). */
export const describeReleaseSourceContract = defineContract<ReleaseSourceFixture>(
  'ReleaseSource',
  (fixture) => {
    it('resolves with the latest published release', async () => {
      const published = aPublishedRelease().forBuild(43).withApk({ sizeBytes: null }).build();
      fixture().givenLatestRelease(published);

      const result = await fixture().source.fetchLatestRelease();

      expect(result).toEqual({ ok: true, value: published });
    });

    it.each(ARRANGEABLE_FAILURES)('resolves (never rejects) with the failure %s', async (code) => {
      fixture().givenFailure(code);

      const result = await fixture().source.fetchLatestRelease();

      expect(result).toMatchObject({ ok: false, error: { code } });
    });

    it('performs exactly one request per call (no caching in the source)', async () => {
      fixture().givenLatestRelease(aPublishedRelease().build());

      await fixture().source.fetchLatestRelease();
      await fixture().source.fetchLatestRelease();

      expect(fixture().requestCount()).toBe(2);
    });
  },
);
