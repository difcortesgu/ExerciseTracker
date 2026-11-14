// @ts-check
/**
 * Signing checks of the release job (S05-02, S05-04; ADR-003 "Signing").
 *
 * The four secrets are the user's one fixed key. The expected certificate fingerprint is public
 * and lives in the repository variable ANDROID_CERT_SHA256; comparing the APK's signer with it
 * proves the APK was signed with that key and not with a debug or generated one, so every release
 * installs over the previous one.
 */

const SIGNING_SECRETS = Object.freeze([
  'ANDROID_KEYSTORE_BASE64',
  'ANDROID_KEYSTORE_PASSWORD',
  'ANDROID_KEY_ALIAS',
  'ANDROID_KEY_PASSWORD',
]);

const CERTIFICATE_FINGERPRINT_VARIABLE = 'ANDROID_CERT_SHA256';

const REQUIRED_RELEASE_SETTINGS = Object.freeze([
  ...SIGNING_SECRETS,
  CERTIFICATE_FINGERPRINT_VARIABLE,
]);

const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * A signer's certificate fingerprint line, in every notation apksigner uses: `Signer #1 certificate
 * SHA-256 digest:` (v1 / mixed schemes) and `V2 Signer: certificate SHA-256 digest:` (v2/v3 only, our
 * case with minSdk >= 24). `public key SHA-256 digest` lines are not certificates and don't match.
 */
const SIGNER_SHA256_PREFIX = /^.*Signer\b.*?\bcertificate SHA-256 digest: /;

/**
 * @param {Readonly<Record<string, string | undefined>>} env
 * @returns {string[]} names of required settings that are missing or blank, in a fixed order
 */
function findMissingReleaseSettings(env) {
  return REQUIRED_RELEASE_SETTINGS.filter((name) => (env[name] ?? '').trim() === '');
}

/**
 * @param {string} raw fingerprint in keytool (`AB:CD:…`) or apksigner (`abcd…`) notation
 * @returns {string | null} 64 lower-case hex characters, or null if it is not a SHA-256 digest
 */
function normalizeSha256Fingerprint(raw) {
  const hex = raw.trim().replaceAll(':', '').toLowerCase();
  return SHA256_HEX.test(hex) ? hex : null;
}

/**
 * @param {string} apksignerOutput output of `apksigner verify --print-certs`
 * @param {string} expectedFingerprint value of ANDROID_CERT_SHA256
 * @returns {{ ok: true, value: string } | { ok: false, error: string }} the verified fingerprint
 */
function verifySigningCertificate(apksignerOutput, expectedFingerprint) {
  const expected = normalizeSha256Fingerprint(expectedFingerprint);
  if (expected === null) {
    return {
      ok: false,
      error: `${CERTIFICATE_FINGERPRINT_VARIABLE} is not a SHA-256 fingerprint (64 hex digits, colons allowed).`,
    };
  }
  // The same certificate is reported once per signature scheme; count distinct certificates.
  const signers = [
    ...new Set(
      apksignerOutput
        .split('\n')
        .filter((line) => SIGNER_SHA256_PREFIX.test(line))
        .map((line) => normalizeSha256Fingerprint(line.replace(SIGNER_SHA256_PREFIX, ''))),
    ),
  ];
  if (signers.length === 0) {
    return { ok: false, error: 'The APK has no signer certificate (apksigner found no signer).' };
  }
  if (signers.length > 1) {
    return {
      ok: false,
      error: `Expected exactly one signer certificate, found ${signers.length}: ${signers.join(', ')}.`,
    };
  }
  const [actual] = signers;
  return actual === expected
    ? { ok: true, value: expected }
    : {
        ok: false,
        error: `The APK is signed with certificate ${actual}, expected ${expected} (${CERTIFICATE_FINGERPRINT_VARIABLE}).`,
      };
}

module.exports = {
  CERTIFICATE_FINGERPRINT_VARIABLE,
  SIGNING_SECRETS,
  findMissingReleaseSettings,
  normalizeSha256Fingerprint,
  verifySigningCertificate,
};
