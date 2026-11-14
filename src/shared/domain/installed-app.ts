import type { BuildNumber } from './build-number';

/**
 * Which build of the app is running (Sprint 0.5, ADR-003). Read through the `InstalledAppInfo`
 * port by the updater (S05-06) and the Settings screen (S05-11).
 *
 * - `release`: an APK built by CI; `buildNumber` equals the APK's Android `versionCode`.
 * - `development`: Expo Go or a development build (JS bundle in dev mode). There is no
 *   meaningful build number (Expo Go would report its own), so the updater stays inactive.
 *
 * `version` is the user-visible version name (`expo.version`, e.g. `0.1.0`) in both cases.
 */
export type InstalledApp = ReleaseInstall | DevelopmentInstall;

export interface ReleaseInstall {
  readonly kind: 'release';
  readonly version: string;
  readonly buildNumber: BuildNumber;
}

export interface DevelopmentInstall {
  readonly kind: 'development';
  readonly version: string;
}
