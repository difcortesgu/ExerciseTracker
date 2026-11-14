import type { InstalledAppInfo } from '@shared/application/installed-app-info';

import { defineContract } from './contract-harness';

/**
 * Arranges an implementation in a given runtime situation. Each implementation translates the
 * situation to its own boundary (the fake takes the value, the Expo adapter fake native readings).
 */
export interface InstalledAppInfoScenarios {
  /** A release APK built by CI with this version name and Android `versionCode`. */
  releaseBuild(version: string, buildNumber: number): InstalledAppInfo;
  /** Expo Go or a development bundle of this version. */
  developmentBuild(version: string): InstalledAppInfo;
}

/** Contract every `InstalledAppInfo` implementation must honour (Sprint 0.5, S05-06/S05-11). */
export const describeInstalledAppInfoContract = defineContract<InstalledAppInfoScenarios>(
  'InstalledAppInfo',
  (scenarios) => {
    it('reports a release build with its version and build number', () => {
      const installed = scenarios().releaseBuild('0.1.0', 42).getInstalledApp();

      expect(installed).toEqual({ kind: 'release', version: '0.1.0', buildNumber: 42 });
    });

    it('reports a development build with its version and no build number', () => {
      const installed = scenarios().developmentBuild('0.2.0').getInstalledApp();

      expect(installed).toEqual({ kind: 'development', version: '0.2.0' });
    });

    it('gives the same answer every time during one process', () => {
      const info = scenarios().releaseBuild('0.1.0', 7);

      expect(info.getInstalledApp()).toBe(info.getInstalledApp());
    });
  },
);
