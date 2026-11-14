import type { Brand } from './brand';
import { domainError, type DomainError } from './domain-error';
import { err, ok, type Result } from './result';

/**
 * Monotonic build number of a release build (Sprint 0.5, ADR-003): equal to the Android
 * `versionCode` of the APK and to the number in its GitHub Release tag (`build-<n>`).
 * A whole number from 1 to `MAX_ANDROID_VERSION_CODE` (2 100 000 000, Android's upper limit).
 * Created only by {@link parseBuildNumber}.
 */
export type BuildNumber = Brand<number, 'BuildNumber'>;

export type InvalidBuildNumberError = DomainError<'shared.invalidBuildNumber'>;

/** Highest Android `versionCode` the platform accepts (same value as tooling/release). */
export const MAX_ANDROID_VERSION_CODE = 2_100_000_000;

function isBuildNumber(raw: number): raw is BuildNumber {
  return Number.isInteger(raw) && raw >= 1 && raw <= MAX_ANDROID_VERSION_CODE;
}

/** Validating factory: a whole number from 1 to {@link MAX_ANDROID_VERSION_CODE}. */
export function parseBuildNumber(raw: number): Result<BuildNumber, InvalidBuildNumberError> {
  return isBuildNumber(raw)
    ? ok(raw)
    : err(
        domainError(
          'shared.invalidBuildNumber',
          `A build number must be a whole number from 1 to ${MAX_ANDROID_VERSION_CODE}.`,
          { value: raw },
        ),
      );
}
