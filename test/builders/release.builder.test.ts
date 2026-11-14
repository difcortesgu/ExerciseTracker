import { aPublishedAsset, aPublishedRelease, aRelease } from './release.builder';

describe('release builders', () => {
  describe('aPublishedRelease', () => {
    it('builds the release CI publishes for build 42 by default', () => {
      expect(aPublishedRelease().build()).toEqual({
        tagName: 'build-42',
        assets: [
          {
            name: 'exercise-tracker-build-42.apk',
            downloadUrl:
              'https://github.com/difcortesgu/ExerciseTracker/releases/download/build-42/exercise-tracker-build-42.apk',
            sizeBytes: 31_457_280,
          },
        ],
      });
    });

    it('builds the release of another build number', () => {
      const published = aPublishedRelease().forBuild(7).build();

      expect(published.tagName).toBe('build-7');
      expect(published.assets).toEqual([
        expect.objectContaining({
          name: 'exercise-tracker-build-7.apk',
          downloadUrl: expect.stringContaining('/build-7/exercise-tracker-build-7.apk') as unknown,
        }),
      ]);
    });

    it('overrides the tag, the APK fields and the asset list', () => {
      const published = aPublishedRelease().withTag('v1').withApk({ sizeBytes: null }).build();
      const noAssets = aPublishedRelease().withAssets().build();

      expect(published.tagName).toBe('v1');
      expect(published.assets[0]?.sizeBytes).toBeNull();
      expect(noAssets.assets).toEqual([]);
    });

    it('returns a new builder from every method, leaving the original unchanged', () => {
      const base = aPublishedRelease();

      base.withTag('changed').withAssets();

      expect(base.build().tagName).toBe('build-42');
      expect(base.build().assets).toHaveLength(1);
    });
  });

  describe('aPublishedAsset', () => {
    it('builds a valid APK asset and overrides the given fields', () => {
      expect(aPublishedAsset({ name: 'notes.txt' })).toMatchObject({
        name: 'notes.txt',
        sizeBytes: 31_457_280,
      });
    });
  });

  describe('aRelease', () => {
    it('builds a validated release for build 42 by default', () => {
      const release = aRelease().build();

      expect(release.buildNumber).toBe(42);
      expect(release.apk).toEqual(aPublishedRelease().build().assets[0]);
    });

    it('sets the build number and the APK size', () => {
      const release = aRelease().forBuild(43).withSize(1024).build();

      expect(release.buildNumber).toBe(43);
      expect(release.apk.sizeBytes).toBe(1024);
      expect(release.apk.name).toBe('exercise-tracker-build-43.apk');
    });

    it('fails loudly when asked for an invalid release', () => {
      expect(() => aRelease().forBuild(0).build()).toThrow('updates.invalidBuildNumber');
    });
  });
});
