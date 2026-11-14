import {
  APP_BUILD_NUMBER_ENV,
  apkFileNameForBuild,
  MAX_ANDROID_VERSION_CODE,
  parseBuildNumber,
  parseBuildTag,
  tagForBuild,
  titleForBuild,
} from './release-format';

describe('release format (ADR-003, read by the app through the GitHub API)', () => {
  it('tags a build as build-<n>', () => {
    expect(tagForBuild(42)).toBe('build-42');
  });

  it('titles a release "Build <n>"', () => {
    expect(titleForBuild(42)).toBe('Build 42');
  });

  it('names the APK asset after the build', () => {
    expect(apkFileNameForBuild(42)).toBe('exercise-tracker-build-42.apk');
  });

  it('passes the build number to the Expo config through APP_BUILD_NUMBER', () => {
    expect(APP_BUILD_NUMBER_ENV).toBe('APP_BUILD_NUMBER');
  });

  it('uses the highest versionCode Android accepts as the upper limit', () => {
    expect(MAX_ANDROID_VERSION_CODE).toBe(2_100_000_000);
  });
});

describe('parseBuildNumber', () => {
  it.each([
    ['1', 1],
    ['42', 42],
    ['2100000000', 2_100_000_000],
  ])('accepts the whole number %s', (raw, expected) => {
    expect(parseBuildNumber(raw)).toBe(expected);
  });

  it.each(['', ' ', '0', '-1', '1.5', '01', '1e3', '0x10', 'abc', '2100000001', ' 7'])(
    'rejects %j',
    (raw) => {
      expect(parseBuildNumber(raw)).toBeNull();
    },
  );
});

describe('parseBuildTag', () => {
  it('reads the build number from a build tag', () => {
    expect(parseBuildTag('build-17')).toBe(17);
  });

  it.each(['v1.0.0', 'build-', 'build-0', 'build-01', 'Build-3', 'build-3-fix', 'xbuild-3'])(
    'ignores the tag %j',
    (tag) => {
      expect(parseBuildTag(tag)).toBeNull();
    },
  );
});
