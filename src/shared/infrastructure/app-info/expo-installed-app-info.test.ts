import Constants from 'expo-constants';

import { describeInstalledAppInfoContract } from '@test/contracts/installed-app-info.contract';
import { RecordingLogger } from '@test/fakes/recording-logger';

import {
  createExpoInstalledAppInfo,
  ExpoInstalledAppInfo,
  readExpoAppReadings,
  UNKNOWN_VERSION,
  type NativeAppReadings,
} from './expo-installed-app-info';

// Native module boundaries: values the native app reports (versionCode, versionName, runtime).
jest.mock('expo-application', () => ({
  nativeBuildVersion: '57',
  nativeApplicationVersion: '0.1.0',
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'bare', expoConfig: { version: '0.1.0' } },
  ExecutionEnvironment: { Bare: 'bare', Standalone: 'standalone', StoreClient: 'storeClient' },
}));

const RELEASE_READINGS: NativeAppReadings = {
  runsInExpoClient: false,
  isDevelopmentBundle: false,
  nativeBuildVersion: '42',
  nativeApplicationVersion: '0.1.0',
  configVersion: '0.1.0',
};

function infoFor(overrides: Partial<NativeAppReadings>, logger = new RecordingLogger()) {
  return { info: new ExpoInstalledAppInfo({ ...RELEASE_READINGS, ...overrides }, logger), logger };
}

describeInstalledAppInfoContract('ExpoInstalledAppInfo', () => ({
  releaseBuild: (version, buildNumber) =>
    infoFor({
      nativeBuildVersion: String(buildNumber),
      nativeApplicationVersion: version,
      configVersion: version,
    }).info,
  developmentBuild: (version) =>
    infoFor({ runsInExpoClient: true, nativeBuildVersion: '300', configVersion: version }).info,
}));

describe('ExpoInstalledAppInfo', () => {
  it('reports a CI release build with its native versionCode and versionName', () => {
    expect(infoFor({}).info.getInstalledApp()).toEqual({
      kind: 'release',
      version: '0.1.0',
      buildNumber: 42,
    });
  });

  it("treats Expo Go as development and never reads Expo Go's own build number", () => {
    const { info } = infoFor({
      runsInExpoClient: true,
      nativeBuildVersion: '300',
      nativeApplicationVersion: '2.33.0',
      configVersion: '0.1.0',
    });

    expect(info.getInstalledApp()).toEqual({ kind: 'development', version: '0.1.0' });
  });

  it('treats a development bundle (__DEV__) as development', () => {
    expect(infoFor({ isDevelopmentBundle: true }).info.getInstalledApp().kind).toBe('development');
  });

  it.each([null, '', 'abc', '0', '1.5', '2100000001'])(
    'falls back to development and warns when the release build number is %p',
    (nativeBuildVersion) => {
      const { info, logger } = infoFor({ nativeBuildVersion });

      expect(info.getInstalledApp()).toEqual({ kind: 'development', version: '0.1.0' });
      expect(logger.entriesAt('warn')).toEqual([
        expect.objectContaining({
          context: expect.objectContaining({
            code: 'shared.invalidBuildNumber',
            nativeBuildVersion,
          }) as unknown,
        }),
      ]);
    },
  );

  it('falls back to the configured version, then to "unknown"', () => {
    const configured = infoFor({ nativeApplicationVersion: null, configVersion: '0.2.0' });
    const unknownRelease = infoFor({ nativeApplicationVersion: null, configVersion: null });
    const unknownDevelopment = infoFor({ isDevelopmentBundle: true, configVersion: null });

    expect(configured.info.getInstalledApp().version).toBe('0.2.0');
    expect(unknownRelease.info.getInstalledApp().version).toBe(UNKNOWN_VERSION);
    expect(unknownDevelopment.info.getInstalledApp().version).toBe(UNKNOWN_VERSION);
  });

  it('reads the native values once and warns at most once per process', () => {
    const { info, logger } = infoFor({ nativeBuildVersion: 'abc' });

    info.getInstalledApp();
    info.getInstalledApp();

    expect(logger.entriesAt('warn')).toHaveLength(1);
  });

  it('returns an immutable answer', () => {
    expect(Object.isFrozen(infoFor({}).info.getInstalledApp())).toBe(true);
  });
});

describe('readExpoAppReadings', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reads expo-application, expo-constants and the bundle mode', () => {
    expect(readExpoAppReadings()).toEqual({
      runsInExpoClient: false,
      isDevelopmentBundle: __DEV__,
      nativeBuildVersion: '57',
      nativeApplicationVersion: '0.1.0',
      configVersion: '0.1.0',
    });
  });

  it('reports no configured version when the Expo config is unavailable', () => {
    jest.replaceProperty(Constants, 'expoConfig', null);

    expect(readExpoAppReadings().configVersion).toBeNull();
  });
});

describe('createExpoInstalledAppInfo', () => {
  it('creates the adapter from the native readings', () => {
    const info = createExpoInstalledAppInfo(new RecordingLogger());

    expect(info).toBeInstanceOf(ExpoInstalledAppInfo);
    // Jest runs a development bundle (__DEV__), so the updater would stay inactive here.
    expect(info.getInstalledApp().kind).toBe('development');
  });
});
