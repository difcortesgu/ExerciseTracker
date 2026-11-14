import appJson from '../../app.json';

import { INSTALL_PACKAGES_PERMISSION } from './apk-badging';
import { withReleaseBuildNumber } from './app-config';

const BASE_CONFIG = {
  name: 'Exercise Tracker',
  slug: 'exercise-tracker',
  version: '0.1.0',
  android: { package: 'com.farid.exercisetracker' },
};

describe('withReleaseBuildNumber (S05-01, used by app.config.js)', () => {
  it('leaves the config untouched without APP_BUILD_NUMBER (Expo Go and local development)', () => {
    expect(withReleaseBuildNumber(BASE_CONFIG, {})).toBe(BASE_CONFIG);
  });

  it('treats an empty APP_BUILD_NUMBER as absent', () => {
    expect(withReleaseBuildNumber(BASE_CONFIG, { APP_BUILD_NUMBER: '' })).toBe(BASE_CONFIG);
  });

  it('sets the Android versionCode to the build number for a release build', () => {
    const config = withReleaseBuildNumber(BASE_CONFIG, { APP_BUILD_NUMBER: '42' });

    expect(config.android).toEqual({ package: 'com.farid.exercisetracker', versionCode: 42 });
  });

  it('keeps the user-visible version unchanged (only the build number changes per build)', () => {
    const config = withReleaseBuildNumber(BASE_CONFIG, { APP_BUILD_NUMBER: '42' });

    expect(config.version).toBe('0.1.0');
  });

  it('does not modify the config it was given', () => {
    withReleaseBuildNumber(BASE_CONFIG, { APP_BUILD_NUMBER: '42' });

    expect(BASE_CONFIG.android).toEqual({ package: 'com.farid.exercisetracker' });
  });

  it('adds an android section when the config has none', () => {
    const { android: _android, ...withoutAndroid } = BASE_CONFIG;

    expect(withReleaseBuildNumber(withoutAndroid, { APP_BUILD_NUMBER: '7' }).android).toEqual({
      versionCode: 7,
    });
  });

  it.each(['0', '-3', '1.5', 'abc', '2100000001'])(
    'fails loudly for the invalid build number %j instead of building a wrong APK',
    (raw) => {
      expect(() => withReleaseBuildNumber(BASE_CONFIG, { APP_BUILD_NUMBER: raw })).toThrow(
        /APP_BUILD_NUMBER/,
      );
    },
  );
});

describe('static app config (app.json) for release builds', () => {
  it('uses the package name of sprint 0 decision 7, so the release installs next to Expo Go', () => {
    expect(appJson.expo.android.package).toBe('com.farid.exercisetracker');
  });

  it('declares the install-packages permission needed for the installer hand-off (S05-10)', () => {
    expect(appJson.expo.android.permissions).toContain(INSTALL_PACKAGES_PERMISSION);
  });
});
