import { INSTALL_PACKAGES_PERMISSION, verifyApkBadging } from './apk-badging';

const EXPECTED = {
  packageName: 'com.farid.exercisetracker',
  versionCode: 42,
  versionName: '0.1.0',
  requiredPermissions: [INSTALL_PACKAGES_PERMISSION],
};

const badging = ({
  name = 'com.farid.exercisetracker',
  versionCode = '42',
  versionName = '0.1.0',
  permissions = ['android.permission.INTERNET', INSTALL_PACKAGES_PERMISSION],
} = {}): string =>
  [
    `package: name='${name}' versionCode='${versionCode}' versionName='${versionName}' platformBuildVersionName='16'`,
    "sdkVersion:'24'",
    ...permissions.map((permission) => `uses-permission: name='${permission}'`),
    "application-label:'Exercise Tracker'",
  ].join('\n');

describe('verifyApkBadging (S05-01, S05-02, S05-10)', () => {
  it('needs the install-packages permission for the installer hand-off', () => {
    expect(INSTALL_PACKAGES_PERMISSION).toBe('android.permission.REQUEST_INSTALL_PACKAGES');
  });

  it('accepts an APK with the expected package, versionCode, versionName and permissions', () => {
    expect(verifyApkBadging(badging(), EXPECTED)).toEqual({ ok: true, value: undefined });
  });

  it('rejects another package name (the release must install next to Expo Go)', () => {
    const result = verifyApkBadging(badging({ name: 'host.exp.exponent' }), EXPECTED);

    expect(result).toEqual({ ok: false, error: expect.stringContaining('host.exp.exponent') });
  });

  it('rejects a versionCode that differs from the build number', () => {
    const result = verifyApkBadging(badging({ versionCode: '1' }), EXPECTED);

    expect(result).toEqual({ ok: false, error: expect.stringContaining('versionCode') });
  });

  it('rejects a changed versionName (only the build number changes per build)', () => {
    const result = verifyApkBadging(badging({ versionName: '0.2.0' }), EXPECTED);

    expect(result).toEqual({ ok: false, error: expect.stringContaining('versionName') });
  });

  it('rejects an APK without the install-packages permission', () => {
    const result = verifyApkBadging(
      badging({ permissions: ['android.permission.INTERNET'] }),
      EXPECTED,
    );

    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining(INSTALL_PACKAGES_PERMISSION),
    });
  });

  it('lists every problem at once', () => {
    const result = verifyApkBadging(badging({ versionCode: '1', versionName: '9' }), EXPECTED);

    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/versionCode[\s\S]*versionName/),
    });
  });

  it('treats an attribute missing from the package line as empty', () => {
    const result = verifyApkBadging(
      "package: name='com.farid.exercisetracker' versionCode='42'\nuses-permission: name='android.permission.REQUEST_INSTALL_PACKAGES'",
      EXPECTED,
    );

    expect(result).toEqual({
      ok: false,
      error: 'The APK does not match the release: versionName is "", expected "0.1.0".',
    });
  });

  it('rejects output without a package line', () => {
    expect(verifyApkBadging('ERROR: dump failed', EXPECTED)).toEqual({
      ok: false,
      error: expect.stringContaining('package line'),
    });
  });
});
