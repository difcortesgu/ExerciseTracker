import { MAX_ANDROID_VERSION_CODE } from '@shared/domain/build-number';
import { aPublishedAsset, aPublishedRelease } from '@test/builders/release.builder';
import { unwrap, unwrapErr } from '@test/support/unwrap';

import { parseRelease, RELEASE_TAG_PREFIX, TRUSTED_DOWNLOAD_HOSTS } from './release';

const GITHUB_DOWNLOAD =
  'https://github.com/difcortesgu/ExerciseTracker/releases/download/build-42/app.apk';

describe('release format constants (ADR-003, same values as tooling/release)', () => {
  it('tags releases build-<n>', () => {
    expect(RELEASE_TAG_PREFIX).toBe('build-');
  });

  it('trusts downloads from github.com only', () => {
    expect(TRUSTED_DOWNLOAD_HOSTS).toEqual(['github.com']);
  });
});

describe('parseRelease', () => {
  describe('a valid release', () => {
    it('reads the build number from the tag and the single APK asset', () => {
      const published = aPublishedRelease()
        .withTag('build-42')
        .withAssets(
          aPublishedAsset({ name: 'notes.txt' }),
          aPublishedAsset({ name: 'app.apk', downloadUrl: GITHUB_DOWNLOAD, sizeBytes: 1234 }),
        )
        .build();

      const release = unwrap(parseRelease(published));

      expect(release).toEqual({
        buildNumber: 42,
        apk: { name: 'app.apk', downloadUrl: GITHUB_DOWNLOAD, sizeBytes: 1234 },
      });
    });

    it('returns an immutable release', () => {
      const release = unwrap(parseRelease(aPublishedRelease().build()));

      expect(Object.isFrozen(release)).toBe(true);
      expect(Object.isFrozen(release.apk)).toBe(true);
    });

    it.each([['build-1'], [`build-${MAX_ANDROID_VERSION_CODE}`]])('accepts the tag %s', (tag) => {
      expect(parseRelease(aPublishedRelease().withTag(tag).build()).ok).toBe(true);
    });

    it.each(['APP.APK', 'app.Apk'])('recognises the APK %s case-insensitively', (name) => {
      const release = unwrap(parseRelease(aPublishedRelease().withApk({ name }).build()));

      expect(release.apk.name).toBe(name);
    });

    it.each([
      'HTTPS://github.com/a.apk',
      'https://GitHub.COM/a.apk',
      'https://github.com:443/a.apk',
      'https://github.com',
      'https://github.com?download=1',
    ])('accepts the https GitHub URL %s', (downloadUrl) => {
      const release = unwrap(parseRelease(aPublishedRelease().withApk({ downloadUrl }).build()));

      expect(release.apk.downloadUrl).toBe(downloadUrl);
    });
  });

  describe('build number', () => {
    it.each([
      'v1.0.0',
      'build-',
      'build-0',
      'build-01',
      'Build-3',
      'build-3-fix',
      'xbuild-3',
      'build-1.5',
      'build--3',
      ' build-3',
      `build-${MAX_ANDROID_VERSION_CODE + 1}`,
      'build-99999999999999999999999',
    ])('rejects the tag %j with updates.invalidBuildNumber', (tag) => {
      const error = unwrapErr(parseRelease(aPublishedRelease().withTag(tag).build()));

      expect(error).toMatchObject({ code: 'updates.invalidBuildNumber', details: { tag } });
    });
  });

  describe('APK asset', () => {
    it('rejects a release without assets with updates.missingApkAsset', () => {
      const error = unwrapErr(parseRelease(aPublishedRelease().withAssets().build()));

      expect(error.code).toBe('updates.missingApkAsset');
    });

    it('rejects a release whose assets are not APKs with updates.missingApkAsset', () => {
      const published = aPublishedRelease()
        .withAssets(aPublishedAsset({ name: 'app.apk.sha256' }), aPublishedAsset({ name: 'apk' }))
        .build();

      const error = unwrapErr(parseRelease(published));

      expect(error).toMatchObject({
        code: 'updates.missingApkAsset',
        details: { assetNames: ['app.apk.sha256', 'apk'] },
      });
    });

    it('rejects a release with two APKs with updates.multipleApkAssets', () => {
      const published = aPublishedRelease()
        .withAssets(aPublishedAsset({ name: 'a.apk' }), aPublishedAsset({ name: 'b.APK' }))
        .build();

      const error = unwrapErr(parseRelease(published));

      expect(error).toMatchObject({
        code: 'updates.multipleApkAssets',
        details: { assetNames: ['a.apk', 'b.APK'] },
      });
    });
  });

  describe('asset size', () => {
    it.each([null, 0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      'rejects the size %p with updates.invalidAssetSize',
      (sizeBytes) => {
        const error = unwrapErr(parseRelease(aPublishedRelease().withApk({ sizeBytes }).build()));

        expect(error).toMatchObject({ code: 'updates.invalidAssetSize', details: { sizeBytes } });
      },
    );
  });

  describe('download URL', () => {
    it.each([
      'http://github.com/a.apk',
      'ftp://github.com/a.apk',
      '//github.com/a.apk',
      'github.com/a.apk',
      '/releases/a.apk',
      'https://',
      'https:///a.apk',
      'https://github.com/a b.apk',
      ' https://github.com/a.apk',
      '',
    ])('rejects %j with updates.insecureDownloadUrl', (downloadUrl) => {
      const error = unwrapErr(parseRelease(aPublishedRelease().withApk({ downloadUrl }).build()));

      expect(error).toMatchObject({
        code: 'updates.insecureDownloadUrl',
        details: { downloadUrl },
      });
    });

    it.each([
      'https://evil.example/a.apk',
      'https://github.com.evil.example/a.apk',
      'https://evilgithub.com/a.apk',
      'https://objects.githubusercontent.com/a.apk',
      'https://github.com./a.apk',
      'https://github.com@evil.example/a.apk',
      'https://user:pass@github.com/a.apk',
      'https://github.com:abc/a.apk',
    ])('rejects %j with updates.untrustedDownloadHost', (downloadUrl) => {
      const error = unwrapErr(parseRelease(aPublishedRelease().withApk({ downloadUrl }).build()));

      expect(error).toMatchObject({
        code: 'updates.untrustedDownloadHost',
        details: { downloadUrl },
      });
    });
  });
});

describe('parseRelease error messages (logged with the code, S05-06)', () => {
  it.each([
    ['updates.invalidBuildNumber', aPublishedRelease().withTag('v42')],
    ['updates.missingApkAsset', aPublishedRelease().withAssets()],
    [
      'updates.multipleApkAssets',
      aPublishedRelease().withAssets(
        aPublishedAsset({ name: 'a.apk' }),
        aPublishedAsset({ name: 'b.apk' }),
      ),
    ],
    ['updates.invalidAssetSize', aPublishedRelease().withApk({ sizeBytes: 0 })],
    ['updates.insecureDownloadUrl', aPublishedRelease().withApk({ downloadUrl: 'http://x/a.apk' })],
    [
      'updates.untrustedDownloadHost',
      aPublishedRelease().withApk({ downloadUrl: 'https://evil.example/a.apk' }),
    ],
  ])('explains %s in a readable message', (code, published) => {
    const error = unwrapErr(parseRelease(published.build()));

    expect(error.code).toBe(code);
    expect(error.message.trim()).not.toBe('');
  });
});
