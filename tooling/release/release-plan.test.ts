import { planRelease, resolveBuildNumber } from './release-plan';

const lsRemote = (...tags: string[]): string =>
  tags.map((tag, index) => `${String(index).padStart(40, 'a')}\trefs/tags/${tag}`).join('\n');

describe('resolveBuildNumber (S05-01)', () => {
  it('uses the workflow run number as the build number', () => {
    expect(resolveBuildNumber({ runNumber: '57', offset: undefined })).toEqual({
      ok: true,
      value: 57,
    });
  });

  it('treats an empty offset as no offset', () => {
    expect(resolveBuildNumber({ runNumber: '57', offset: '' })).toEqual({ ok: true, value: 57 });
  });

  it('adds the configured offset (escape hatch if the run counter ever restarts)', () => {
    expect(resolveBuildNumber({ runNumber: '3', offset: '1000' })).toEqual({
      ok: true,
      value: 1003,
    });
  });

  it.each([undefined, '', '0', 'abc'])('rejects the run number %j', (runNumber) => {
    const result = resolveBuildNumber({ runNumber, offset: undefined });

    expect(result).toEqual({ ok: false, error: expect.stringContaining('GITHUB_RUN_NUMBER') });
  });

  it.each(['-1', '1.5', 'ten'])('rejects the offset %j', (offset) => {
    const result = resolveBuildNumber({ runNumber: '3', offset });

    expect(result).toEqual({ ok: false, error: expect.stringContaining('BUILD_NUMBER_OFFSET') });
  });

  it('accepts an explicit zero offset', () => {
    expect(resolveBuildNumber({ runNumber: '3', offset: '0' })).toEqual({ ok: true, value: 3 });
  });

  it('rejects a sum above the highest Android versionCode', () => {
    const result = resolveBuildNumber({ runNumber: '2', offset: '2100000000' });

    expect(result).toEqual({ ok: false, error: expect.stringContaining('2100000000') });
  });
});

describe('planRelease (S05-01, S05-03)', () => {
  it('publishes the first release when no build tag exists yet', () => {
    expect(planRelease({ buildNumber: 5, remoteTags: '' })).toEqual({
      kind: 'publish',
      tag: 'build-5',
      title: 'Build 5',
      assetName: 'exercise-tracker-build-5.apk',
    });
  });

  it('publishes a build newer than every published build, ignoring other tags', () => {
    const plan = planRelease({
      buildNumber: 12,
      remoteTags: lsRemote('build-9', 'v0.1.0', 'build-11', 'build-11^{}'),
    });

    expect(plan).toEqual(expect.objectContaining({ kind: 'publish', tag: 'build-12' }));
  });

  it('does not publish a build number that is already published (re-run of a published run)', () => {
    const plan = planRelease({ buildNumber: 12, remoteTags: lsRemote('build-12') });

    expect(plan).toEqual({ kind: 'alreadyPublished', tag: 'build-12' });
  });

  it('does not publish an older build after a newer one (latest always has the highest number)', () => {
    const plan = planRelease({ buildNumber: 12, remoteTags: lsRemote('build-7', 'build-13') });

    expect(plan).toEqual({ kind: 'superseded', latestBuild: 13 });
  });

  it('ignores blank lines and lines that are not tag refs', () => {
    const plan = planRelease({
      buildNumber: 2,
      remoteTags: '\n\nnot a ref line\n' + lsRemote('build-1') + '\n',
    });

    expect(plan).toEqual(expect.objectContaining({ kind: 'publish' }));
  });
});
