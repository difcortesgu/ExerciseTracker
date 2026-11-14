import type { Brand } from '@shared/domain/brand';
import { parseBuildNumber, type BuildNumber } from '@shared/domain/build-number';
import { domainError, type DomainError } from '@shared/domain/domain-error';
import { andThen, err, map, mapErr, ok, type Result } from '@shared/domain/result';

/**
 * Release model of the self-updater (Sprint 0.5, S05-05, ADR-003 "Release format").
 *
 * `parseRelease` validates what the release source reports. Parsing uses anchored regular
 * expressions, not the `URL` global (keeps the domain free of platform polyfill differences).
 * The same format is implemented for CI in `tooling/release/release-format.js`; both are pinned
 * by tests with the same examples.
 */

/** Tags of published builds are `build-<n>` (ADR-003 §5). */
export const RELEASE_TAG_PREFIX = 'build-';

/**
 * Hosts an APK may be downloaded from: GitHub's `browser_download_url` host (exact match, case
 * insensitive). The native downloader follows GitHub's redirect to its asset CDN.
 */
export const TRUSTED_DOWNLOAD_HOSTS: readonly string[] = Object.freeze(['github.com']);

/** An absolute `https://` URL on a trusted GitHub host; only `parseRelease` creates one. */
export type HttpsUrl = Brand<string, 'HttpsUrl'>;

/**
 * A published GitHub Release as the release source reports it, before any validation.
 * Drafts and pre-releases never reach this type (the source asks for the latest published one).
 */
export interface PublishedRelease {
  /** Git tag, expected format `build-<n>` (e.g. `build-42`). */
  readonly tagName: string;
  readonly assets: readonly PublishedReleaseAsset[];
}

export interface PublishedReleaseAsset {
  /** File name, e.g. `exercise-tracker-build-42.apk`; an APK is recognised by `.apk` (any case). */
  readonly name: string;
  /** GitHub's `browser_download_url`. */
  readonly downloadUrl: string;
  /** Size in bytes as reported by GitHub; `null` when the response did not contain one. */
  readonly sizeBytes: number | null;
}

/** A validated release: one APK, a strictly positive build number, a trusted https URL. */
export interface Release {
  readonly buildNumber: BuildNumber;
  readonly apk: ApkAsset;
}

export interface ApkAsset {
  readonly name: string;
  readonly downloadUrl: HttpsUrl;
  /** Whole number of bytes, greater than zero; the download must match it exactly. */
  readonly sizeBytes: number;
}

/** Why a published release cannot be offered as an update. */
export type ReleaseErrorCode =
  /** The tag is not `build-<n>` with n a whole number from 1 to the Android maximum. */
  | 'updates.invalidBuildNumber'
  /** No asset ends in `.apk`. */
  | 'updates.missingApkAsset'
  /** More than one asset ends in `.apk`. */
  | 'updates.multipleApkAssets'
  /** The APK's size is missing, not a whole number, or not greater than zero. */
  | 'updates.invalidAssetSize'
  /** The APK's download URL is not an absolute `https://` URL. */
  | 'updates.insecureDownloadUrl'
  /** The APK's download URL is https but its host is not in `TRUSTED_DOWNLOAD_HOSTS`. */
  | 'updates.untrustedDownloadHost';

export type ReleaseError = DomainError<ReleaseErrorCode>;

const BUILD_TAG = new RegExp(`^${RELEASE_TAG_PREFIX}([1-9]\\d*)$`);
const APK_FILE_NAME = /\.apk$/i;
/** `https://<authority>` optionally followed by a path, query or fragment; no whitespace. */
const ABSOLUTE_HTTPS_URL = /^https:\/\/([^/?#\s]+)(?:[/?#]\S*)?$/i;
/** Host with an optional numeric port; anything else (user info, bad port) is untrusted. */
const HOST_WITH_OPTIONAL_PORT = /^([^:@]+)(?::\d+)?$/;

function parseTag(tagName: string): Result<BuildNumber, ReleaseError> {
  const digits = BUILD_TAG.exec(tagName)?.[1];
  const invalid = domainError(
    'updates.invalidBuildNumber',
    `The release tag must be ${RELEASE_TAG_PREFIX}<n> with n a whole number from 1 upwards.`,
    { tag: tagName },
  );
  return digits === undefined
    ? err(invalid)
    : mapErr(parseBuildNumber(Number(digits)), () => invalid);
}

function findSingleApk(
  assets: readonly PublishedReleaseAsset[],
): Result<PublishedReleaseAsset, ReleaseError> {
  const apks = assets.filter((asset) => APK_FILE_NAME.test(asset.name));
  const [apk] = apks;
  if (apk !== undefined && apks.length === 1) {
    return ok(apk);
  }
  const assetNames = assets.map((asset) => asset.name);
  return apk === undefined
    ? err(domainError('updates.missingApkAsset', 'The release has no .apk asset.', { assetNames }))
    : err(
        domainError('updates.multipleApkAssets', 'The release has more than one .apk asset.', {
          assetNames,
        }),
      );
}

function parseSize(sizeBytes: number | null): Result<number, ReleaseError> {
  return sizeBytes !== null && Number.isInteger(sizeBytes) && sizeBytes > 0
    ? ok(sizeBytes)
    : err(
        domainError(
          'updates.invalidAssetSize',
          'The APK size must be a whole number of bytes greater than zero.',
          { sizeBytes },
        ),
      );
}

const authorityOf = (url: string): string | undefined => ABSOLUTE_HTTPS_URL.exec(url)?.[1];

function isTrustedAuthority(authority: string): boolean {
  const host = HOST_WITH_OPTIONAL_PORT.exec(authority)?.[1];
  return host !== undefined && TRUSTED_DOWNLOAD_HOSTS.includes(host.toLowerCase());
}

function isTrustedHttpsUrl(url: string): url is HttpsUrl {
  const authority = authorityOf(url);
  return authority !== undefined && isTrustedAuthority(authority);
}

function parseDownloadUrl(downloadUrl: string): Result<HttpsUrl, ReleaseError> {
  if (isTrustedHttpsUrl(downloadUrl)) {
    return ok(downloadUrl);
  }
  return authorityOf(downloadUrl) === undefined
    ? err(
        domainError('updates.insecureDownloadUrl', 'The APK URL must be an absolute https URL.', {
          downloadUrl,
        }),
      )
    : err(
        domainError('updates.untrustedDownloadHost', 'The APK URL is not on a trusted host.', {
          downloadUrl,
        }),
      );
}

function parseApk(asset: PublishedReleaseAsset): Result<ApkAsset, ReleaseError> {
  return andThen(parseSize(asset.sizeBytes), (sizeBytes) =>
    map(parseDownloadUrl(asset.downloadUrl), (downloadUrl) =>
      Object.freeze({ name: asset.name, downloadUrl, sizeBytes }),
    ),
  );
}

/**
 * Validates a published release (S05-05): a `build-<n>` tag, exactly one `.apk` asset with a
 * positive whole size and an https download URL on a trusted host. Pure; never throws.
 */
export function parseRelease(published: PublishedRelease): Result<Release, ReleaseError> {
  return andThen(parseTag(published.tagName), (buildNumber) =>
    andThen(findSingleApk(published.assets), (asset) =>
      map(parseApk(asset), (apk) => Object.freeze({ buildNumber, apk })),
    ),
  );
}
