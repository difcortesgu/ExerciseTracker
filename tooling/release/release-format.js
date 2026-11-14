// @ts-check
/**
 * Release format contract (Sprint 0.5, ADR-003 "Release format"). The app's updater reads releases
 * through the GitHub API and relies on exactly this format; its domain parser
 * (`src/modules/updates/domain`) implements the same rules in TypeScript and is tested against the
 * same examples. Two runtimes (Node CI scripts, the React Native app) cannot share one module, so
 * the format is documented once in ADR-003 and pinned by tests on both sides.
 */

const RELEASE_TAG_PREFIX = 'build-';

/** Highest Android `versionCode` Google Play and the platform accept. */
const MAX_ANDROID_VERSION_CODE = 2_100_000_000;

/** Environment variable that carries the build number into the Expo config (app.config.js). */
const APP_BUILD_NUMBER_ENV = 'APP_BUILD_NUMBER';

/** A whole number without sign, leading zeros, exponent or whitespace. */
const WHOLE_NUMBER = /^[1-9]\d*$/;

const BUILD_TAG = new RegExp(`^${RELEASE_TAG_PREFIX}([1-9]\\d*)$`);

/**
 * @param {string} raw decimal text, e.g. from an environment variable or a tag
 * @returns {number | null} the build number, or null unless it is 1..MAX_ANDROID_VERSION_CODE
 */
function parseBuildNumber(raw) {
  if (!WHOLE_NUMBER.test(raw)) {
    return null;
  }
  const value = Number(raw);
  return value <= MAX_ANDROID_VERSION_CODE ? value : null;
}

/**
 * @param {string} tag a git tag name
 * @returns {number | null} the build number of a `build-<n>` tag, or null for any other tag
 */
function parseBuildTag(tag) {
  const match = BUILD_TAG.exec(tag);
  return match?.[1] === undefined ? null : parseBuildNumber(match[1]);
}

/** @param {number} buildNumber */
const tagForBuild = (buildNumber) => `${RELEASE_TAG_PREFIX}${buildNumber}`;

/** @param {number} buildNumber */
const titleForBuild = (buildNumber) => `Build ${buildNumber}`;

/** @param {number} buildNumber */
const apkFileNameForBuild = (buildNumber) => `exercise-tracker-build-${buildNumber}.apk`;

module.exports = {
  APP_BUILD_NUMBER_ENV,
  MAX_ANDROID_VERSION_CODE,
  RELEASE_TAG_PREFIX,
  apkFileNameForBuild,
  parseBuildNumber,
  parseBuildTag,
  tagForBuild,
  titleForBuild,
};
