import type { Release } from '../domain/release';
import type { DownloadProgress } from '../application/apk-downloader';

import type { UpdateFailure } from './update-flow-machine';

/**
 * Presenter of the update prompt: turns release, progress and error data into the strings the
 * presentational components show. Display formatting only; no update rules live here.
 */

const BYTES_PER_MEGABYTE = 1_048_576;
/** From this size on, whole megabytes are precise enough; below it, one decimal. */
const WHOLE_MEGABYTES_FROM = 10;
const PERCENT_MAX = 100;

export function formatMegabytes(bytes: number): string {
  const megabytes = bytes / BYTES_PER_MEGABYTE;
  return megabytes >= WHOLE_MEGABYTES_FROM
    ? `${Math.round(megabytes)} MB`
    : `${megabytes.toFixed(1)} MB`;
}

/** "Build 42 available (35 MB)": the size helps decide on mobile data (Q4). */
export function offerTitle(release: Release): string {
  return `Build ${release.buildNumber} available (${formatMegabytes(release.apk.sizeBytes)})`;
}

export function downloadTitle(release: Release): string {
  return `Downloading build ${release.buildNumber}`;
}

/** Whole percent, rounded down (100% only when complete), clamped to 0..100. */
export function downloadPercent({ receivedBytes, totalBytes }: DownloadProgress): number {
  if (totalBytes <= 0) {
    return 0;
  }
  return Math.min(PERCENT_MAX, Math.floor((receivedBytes / totalBytes) * PERCENT_MAX));
}

export function downloadAmountText({ receivedBytes, totalBytes }: DownloadProgress): string {
  return `${formatMegabytes(receivedBytes)} of ${formatMegabytes(totalBytes)}`;
}

export interface FailureText {
  readonly title: string;
  readonly message: string;
}

const DOWNLOAD_FAILED_TITLE = 'Download failed';
const INSTALLER_FAILED_TITLE = 'Could not open the installer';

/** Readable text per error code; the technical `message` of the error goes to the log only. */
const FAILURE_TEXTS: { readonly [Code in UpdateFailure['code']]: FailureText } = {
  'updates.downloadFailed': {
    title: DOWNLOAD_FAILED_TITLE,
    message: 'The update could not be downloaded. Check your connection and try again.',
  },
  'updates.downloadSizeMismatch': {
    title: DOWNLOAD_FAILED_TITLE,
    message: 'The downloaded update was incomplete, so it was not installed. Try again.',
  },
  'updates.downloadCancelled': {
    title: DOWNLOAD_FAILED_TITLE,
    message: 'The download was stopped before it finished. Try again.',
  },
  'updates.apkMissing': {
    title: INSTALLER_FAILED_TITLE,
    message: 'The downloaded update is no longer on the phone. Retry to download it again.',
  },
  'updates.installerUnavailable': {
    title: INSTALLER_FAILED_TITLE,
    message: "Android's installer could not be opened. Retry to download the update again.",
  },
};

export function failureText(error: UpdateFailure): FailureText {
  return FAILURE_TEXTS[error.code];
}
