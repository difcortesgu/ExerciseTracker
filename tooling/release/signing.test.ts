import {
  CERTIFICATE_FINGERPRINT_VARIABLE,
  findMissingReleaseSettings,
  normalizeSha256Fingerprint,
  SIGNING_SECRETS,
  verifySigningCertificate,
} from './signing';

const FINGERPRINT = 'ab'.repeat(32);
const COMPLETE_ENV = {
  ANDROID_KEYSTORE_BASE64: 'MIIK...',
  ANDROID_KEYSTORE_PASSWORD: 'store-secret',
  ANDROID_KEY_ALIAS: 'release',
  ANDROID_KEY_PASSWORD: 'key-secret',
  ANDROID_CERT_SHA256: FINGERPRINT,
};

const apksignerOutput = (...digests: string[]): string =>
  digests
    .flatMap((digest, index) => [
      `Signer #${index + 1} certificate DN: CN=Exercise Tracker`,
      `Signer #${index + 1} certificate SHA-256 digest: ${digest}`,
      `Signer #${index + 1} certificate SHA-1 digest: ${'cd'.repeat(20)}`,
    ])
    .join('\n');

describe('release settings (S05-02)', () => {
  it('names the four signing secrets the user configured', () => {
    expect(SIGNING_SECRETS).toEqual([
      'ANDROID_KEYSTORE_BASE64',
      'ANDROID_KEYSTORE_PASSWORD',
      'ANDROID_KEY_ALIAS',
      'ANDROID_KEY_PASSWORD',
    ]);
  });

  it('expects the certificate fingerprint in ANDROID_CERT_SHA256', () => {
    expect(CERTIFICATE_FINGERPRINT_VARIABLE).toBe('ANDROID_CERT_SHA256');
  });

  it('reports nothing missing when every setting is present', () => {
    expect(findMissingReleaseSettings(COMPLETE_ENV)).toEqual([]);
  });

  it('names every missing or blank setting, in a fixed order', () => {
    const missing = findMissingReleaseSettings({
      ...COMPLETE_ENV,
      ANDROID_KEYSTORE_PASSWORD: '',
      ANDROID_KEY_ALIAS: '   ',
      ANDROID_CERT_SHA256: undefined,
    });

    expect(missing).toEqual([
      'ANDROID_KEYSTORE_PASSWORD',
      'ANDROID_KEY_ALIAS',
      'ANDROID_CERT_SHA256',
    ]);
  });
});

describe('normalizeSha256Fingerprint', () => {
  it('accepts keytool format (upper case, colon separated)', () => {
    const keytool = FINGERPRINT.toUpperCase().match(/../g)?.join(':') ?? '';

    expect(normalizeSha256Fingerprint(keytool)).toBe(FINGERPRINT);
  });

  it('accepts apksigner format (lower case hex) with surrounding whitespace', () => {
    expect(normalizeSha256Fingerprint(`  ${FINGERPRINT}\n`)).toBe(FINGERPRINT);
  });

  it.each(['', 'ab'.repeat(31), 'zz'.repeat(32), 'ab'.repeat(33)])('rejects %j', (raw) => {
    expect(normalizeSha256Fingerprint(raw)).toBeNull();
  });
});

describe('verifySigningCertificate (S05-02, S05-04)', () => {
  it('accepts an APK signed by exactly the expected certificate', () => {
    expect(verifySigningCertificate(apksignerOutput(FINGERPRINT), FINGERPRINT)).toEqual({
      ok: true,
      value: FINGERPRINT,
    });
  });

  it('compares fingerprints regardless of their notation', () => {
    const keytool = FINGERPRINT.toUpperCase().match(/../g)?.join(':') ?? '';

    expect(verifySigningCertificate(apksignerOutput(FINGERPRINT), keytool).ok).toBe(true);
  });

  it('rejects an APK signed with another key (e.g. the debug key), naming both fingerprints', () => {
    const other = 'ef'.repeat(32);

    const result = verifySigningCertificate(apksignerOutput(other), FINGERPRINT);

    expect(result).toEqual({ ok: false, error: expect.stringContaining(other) });
    expect(result).toEqual({ ok: false, error: expect.stringContaining(FINGERPRINT) });
  });

  it('rejects output without any signer', () => {
    expect(verifySigningCertificate('DOES NOT VERIFY', FINGERPRINT)).toEqual({
      ok: false,
      error: expect.stringContaining('no signer'),
    });
  });

  it('reads the output apksigner really prints for a v2-signed APK (no v1 signature)', () => {
    // Captured from apksigner 37 on an APK built by this project's release configuration.
    const realOutput = [
      'V2 Signer: certificate DN: CN=Throwaway Test',
      `V2 Signer: certificate SHA-256 digest: ${FINGERPRINT}`,
      `V2 Signer: certificate SHA-1 digest: ${'f4'.repeat(20)}`,
      `V2 Signer: certificate MD5 digest: ${'1e'.repeat(16)}`,
    ].join('\n');

    expect(verifySigningCertificate(realOutput, FINGERPRINT)).toEqual({
      ok: true,
      value: FINGERPRINT,
    });
  });

  it('counts a certificate reported by several signature schemes once', () => {
    const output = [
      `Signer #1 certificate SHA-256 digest: ${FINGERPRINT}`,
      `V2 Signer: certificate SHA-256 digest: ${FINGERPRINT}`,
      `V3 Signer: certificate SHA-256 digest: ${FINGERPRINT}`,
    ].join('\n');

    expect(verifySigningCertificate(output, FINGERPRINT).ok).toBe(true);
  });

  it('ignores the public key digest, which is not the certificate fingerprint', () => {
    const output = [
      `V2 Signer: certificate SHA-256 digest: ${FINGERPRINT}`,
      `V2 Signer: public key SHA-256 digest: ${'ef'.repeat(32)}`,
    ].join('\n');

    expect(verifySigningCertificate(output, FINGERPRINT).ok).toBe(true);
  });

  it('rejects an APK signed by more than one certificate', () => {
    const result = verifySigningCertificate(
      apksignerOutput(FINGERPRINT, 'ef'.repeat(32)),
      FINGERPRINT,
    );

    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining('exactly one signer certificate'),
    });
  });

  it('rejects a malformed expected fingerprint instead of comparing against it', () => {
    expect(verifySigningCertificate(apksignerOutput(FINGERPRINT), 'not-a-fingerprint')).toEqual({
      ok: false,
      error: expect.stringContaining('ANDROID_CERT_SHA256'),
    });
  });
});
