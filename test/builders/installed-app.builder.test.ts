import { aBuildNumber, aDevelopmentInstall, aReleaseInstall } from './installed-app.builder';

describe('installed-app builders', () => {
  describe('aBuildNumber', () => {
    it('creates a branded build number through the domain factory', () => {
      expect(aBuildNumber(42)).toBe(42);
    });

    it('fails loudly for an invalid build number', () => {
      expect(() => aBuildNumber(0)).toThrow('shared.invalidBuildNumber');
    });
  });

  describe('aReleaseInstall', () => {
    it('defaults to version 0.1.0, build 41 (one below the default release)', () => {
      expect(aReleaseInstall().build()).toEqual({
        kind: 'release',
        version: '0.1.0',
        buildNumber: 41,
      });
    });

    it('sets the build number and the version', () => {
      expect(aReleaseInstall().withBuildNumber(42).withVersion('1.2.3').build()).toEqual({
        kind: 'release',
        version: '1.2.3',
        buildNumber: 42,
      });
    });

    it('returns a new builder from every method, leaving the original unchanged', () => {
      const base = aReleaseInstall();

      base.withBuildNumber(99).withVersion('9.9.9');

      expect(base.build()).toMatchObject({ version: '0.1.0', buildNumber: 41 });
    });
  });

  describe('aDevelopmentInstall', () => {
    it('defaults to version 0.1.0 and sets another version', () => {
      expect(aDevelopmentInstall().build()).toEqual({ kind: 'development', version: '0.1.0' });
      expect(aDevelopmentInstall().withVersion('2.0.0').build().version).toBe('2.0.0');
    });
  });
});
