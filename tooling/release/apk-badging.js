// @ts-check
/**
 * Identity check of the built APK from `aapt2 dump badging` (S05-01, S05-02, S05-10): the package
 * name, versionCode (= build number), versionName (unchanged) and the permission the installer
 * hand-off needs. Catches a broken Expo config before anything is published.
 */

/** Needed to open Android's package installer for the downloaded update (ADR-003). */
const INSTALL_PACKAGES_PERMISSION = 'android.permission.REQUEST_INSTALL_PACKAGES';

const PACKAGE_LINE = /^package: .*$/m;
const PERMISSION_LINE = /^uses-permission: name='([^']*)'/gm;

/**
 * @typedef {{ packageName: string, versionCode: number, versionName: string,
 *   requiredPermissions: readonly string[] }} ExpectedApk
 */

/**
 * @param {string} line the `package:` line
 * @param {string} key attribute name, e.g. `versionCode`
 * @returns {string} the attribute's value, or '' when the line does not have it
 */
const attribute = (line, key) => new RegExp(` ${key}='([^']*)'`).exec(line)?.[1] ?? '';

/**
 * @param {string} label
 * @param {string} actual
 * @param {string} expected
 * @returns {string[]} one problem when the values differ
 */
const compare = (label, actual, expected) =>
  actual === expected ? [] : [`${label} is "${actual}", expected "${expected}".`];

/**
 * @param {string} badging output of `aapt2 dump badging <apk>`
 * @param {ExpectedApk} expected
 * @returns {{ ok: true, value: undefined } | { ok: false, error: string }}
 */
function verifyApkBadging(badging, expected) {
  const packageLine = PACKAGE_LINE.exec(badging);
  if (packageLine === null) {
    return { ok: false, error: 'aapt2 output has no package line; is the file an APK?' };
  }
  const [line] = packageLine;
  const permissions = new Set([...badging.matchAll(PERMISSION_LINE)].map((match) => match[1]));
  const problems = [
    ...compare('package', attribute(line, 'name'), expected.packageName),
    ...compare('versionCode', attribute(line, 'versionCode'), String(expected.versionCode)),
    ...compare('versionName', attribute(line, 'versionName'), expected.versionName),
    ...expected.requiredPermissions
      .filter((permission) => !permissions.has(permission))
      .map((permission) => `missing permission ${permission}.`),
  ];
  return problems.length === 0
    ? { ok: true, value: undefined }
    : { ok: false, error: `The APK does not match the release: ${problems.join(' ')}` };
}

module.exports = { INSTALL_PACKAGES_PERMISSION, verifyApkBadging };
