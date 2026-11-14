// @ts-check
/**
 * Release part of the dynamic Expo config (S05-01; ADR-003 "Build number"). `app.config.js` applies
 * it to the static `app.json`. Only CI sets APP_BUILD_NUMBER (before `expo prebuild`), so Expo Go
 * and local development read app.json unchanged.
 */
const {
  APP_BUILD_NUMBER_ENV,
  MAX_ANDROID_VERSION_CODE,
  parseBuildNumber,
} = require('./release-format');

/**
 * The part of an Expo config this hook reads and writes; everything else passes through.
 * @typedef {{ [key: string]: unknown, android?: { [key: string]: unknown, versionCode?: number } }} ExpoConfigLike
 */

/**
 * @param {ExpoConfigLike} config the static Expo config
 * @param {Readonly<Record<string, string | undefined>>} env process environment
 * @returns {ExpoConfigLike} the same config without a build number, or a copy with
 *   android.versionCode set
 */
function withReleaseBuildNumber(config, env) {
  const raw = env[APP_BUILD_NUMBER_ENV];
  if (raw === undefined || raw === '') {
    return config;
  }
  const buildNumber = parseBuildNumber(raw);
  if (buildNumber === null) {
    // A wrong versionCode would produce an APK that cannot update the installed one: stop the build.
    throw new Error(
      `${APP_BUILD_NUMBER_ENV} must be a whole number from 1 to ${MAX_ANDROID_VERSION_CODE}, got "${raw}".`,
    );
  }
  return { ...config, android: { ...config.android, versionCode: buildNumber } };
}

module.exports = { withReleaseBuildNumber };
