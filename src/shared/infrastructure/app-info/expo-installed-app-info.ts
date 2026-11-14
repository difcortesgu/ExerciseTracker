import * as Application from 'expo-application';
import Constants, { ExecutionEnvironment } from 'expo-constants';

import type { InstalledAppInfo } from '@shared/application/installed-app-info';
import type { Logger } from '@shared/application/logger';
import { parseBuildNumber } from '@shared/domain/build-number';
import type { InstalledApp } from '@shared/domain/installed-app';

/** Shown when neither the native app nor the Expo config reports a version name. */
export const UNKNOWN_VERSION = 'unknown';

/** The raw values the native runtime reports, read once by {@link readExpoAppReadings}. */
export interface NativeAppReadings {
  /** Expo Go or an `expo-dev-client` build (`ExecutionEnvironment.StoreClient`). */
  readonly runsInExpoClient: boolean;
  /** The JS bundle runs in development mode (`__DEV__`). */
  readonly isDevelopmentBundle: boolean;
  /** Android `versionCode` as text (`expo-application`). */
  readonly nativeBuildVersion: string | null;
  /** Android `versionName` (`expo-application`). */
  readonly nativeApplicationVersion: string | null;
  /** `expo.version` from the app config (`expo-constants`). */
  readonly configVersion: string | null;
}

/**
 * Adapter (ports & adapters): the `InstalledAppInfo` port over native app info (ADR-003 §7).
 * Expo Go and development bundles are `development` (Expo Go's own build number is never read as
 * ours); a release build whose build number cannot be parsed is also `development`, with a warning
 * (fail-safe: no wrong update offer). The answer is computed once and never changes.
 */
export class ExpoInstalledAppInfo implements InstalledAppInfo {
  private installed: InstalledApp | undefined;

  constructor(
    private readonly readings: NativeAppReadings,
    private readonly logger: Logger,
  ) {}

  getInstalledApp(): InstalledApp {
    this.installed ??= Object.freeze(this.identify());
    return this.installed;
  }

  private identify(): InstalledApp {
    const { readings } = this;
    const development: InstalledApp = {
      kind: 'development',
      version: readings.configVersion ?? UNKNOWN_VERSION,
    };
    if (readings.runsInExpoClient || readings.isDevelopmentBundle) {
      return development;
    }
    const raw = readings.nativeBuildVersion;
    const buildNumber = parseBuildNumber(raw === null ? Number.NaN : Number(raw));
    if (!buildNumber.ok) {
      this.logger.warn('Release build without a valid build number; updater stays inactive.', {
        code: buildNumber.error.code,
        nativeBuildVersion: raw,
      });
      return development;
    }
    return {
      kind: 'release',
      version: readings.nativeApplicationVersion ?? development.version,
      buildNumber: buildNumber.value,
    };
  }
}

/** Reads the native boundary (the only place that touches expo-application / expo-constants). */
export function readExpoAppReadings(): NativeAppReadings {
  return {
    runsInExpoClient: Constants.executionEnvironment === ExecutionEnvironment.StoreClient,
    isDevelopmentBundle: __DEV__,
    nativeBuildVersion: Application.nativeBuildVersion,
    nativeApplicationVersion: Application.nativeApplicationVersion,
    configVersion: Constants.expoConfig?.version ?? null,
  };
}

/** Factory used by the composition root. */
export function createExpoInstalledAppInfo(logger: Logger): ExpoInstalledAppInfo {
  return new ExpoInstalledAppInfo(readExpoAppReadings(), logger);
}
