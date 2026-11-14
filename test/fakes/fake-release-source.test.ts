import { describeReleaseSourceContract } from '@test/contracts/release-source.contract';

import { FakeReleaseSource } from './fake-release-source';

describeReleaseSourceContract('FakeReleaseSource', () => {
  const source = new FakeReleaseSource();
  return {
    source,
    givenLatestRelease: (release) => source.respondWith(release),
    givenFailure: (code) => source.failWith(code),
    requestCount: () => source.requestCount,
  };
});

describe('FakeReleaseSource', () => {
  it('answers that nothing is published until a test arranges a release', async () => {
    const result = await new FakeReleaseSource().fetchLatestRelease();

    expect(result).toMatchObject({ ok: false, error: { code: 'updates.noPublishedRelease' } });
  });

  it('counts no request before the first call', () => {
    expect(new FakeReleaseSource().requestCount).toBe(0);
  });
});
