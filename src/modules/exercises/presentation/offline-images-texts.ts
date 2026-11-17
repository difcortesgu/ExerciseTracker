import type { OfflineImagesEstimate, OfflineImagesState } from '../application/offline-images';

/**
 * Presenter of the "Offline images" section (S1-28): turns the estimate and the run state of the
 * `OfflineImages` service into display text. Formatting only; the download rules live in the
 * service.
 */

/** Decimal megabytes (as phones and carriers count data), not MiB. */
const BYTES_PER_MEGABYTE = 1_000_000;
/** From this size on, whole megabytes are precise enough; below it, one decimal. */
const WHOLE_MEGABYTES_FROM = 10;
/** The smallest non-zero amount shown, so a few images never read as "0.0 MB". */
const SMALLEST_SHOWN_MEGABYTES = 0.1;
const THOUSANDS = /\B(?=(\d{3})+(?!\d))/g;

type RunningState = Extract<OfflineImagesState, { status: 'running' }>;
type FinishedState = Omit<Extract<OfflineImagesState, { status: 'finished' }>, 'status'>;
type CancelledState = Omit<Extract<OfflineImagesState, { status: 'cancelled' }>, 'status'>;

/** "1 746": thousands grouped with a space. */
export function formatImageCount(count: number): string {
  return String(count).replace(THOUSANDS, ' ');
}

/** "99 MB", "9.9 MB", "0.1 MB" (any non-zero amount), "0 MB". */
export function formatMegabytesDecimal(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  const megabytes = bytes / BYTES_PER_MEGABYTE;
  if (megabytes >= WHOLE_MEGABYTES_FROM) return `${Math.round(megabytes)} MB`;
  return `${Math.max(SMALLEST_SHOWN_MEGABYTES, megabytes).toFixed(1)} MB`;
}

function imagesText(count: number): string {
  return count === 1 ? '1 image' : `${formatImageCount(count)} images`;
}

/** "1 746 images, about 99 MB. Use Wi-Fi if you can." */
export function confirmationMessage({ missingCount, missingBytes }: OfflineImagesEstimate): string {
  return `${imagesText(missingCount)}, about ${formatMegabytesDecimal(missingBytes)}. Use Wi-Fi if you can.`;
}

/** "496 of 1 746 images are not on this phone yet." */
export function missingImagesText({ missingCount, totalCount }: OfflineImagesEstimate): string {
  return `${formatImageCount(missingCount)} of ${formatImageCount(totalCount)} images are not on this phone yet.`;
}

/** "250 of 1 512": every finished image counts, failed ones included. */
export function progressText({ completed, failed, total }: RunningState): string {
  return `${formatImageCount(completed + failed)} of ${formatImageCount(total)}`;
}

/** "Image download progress, 250 of 1 512" (the progress bar's accessibility label). */
export function progressLabel(state: RunningState): string {
  return `Image download progress, ${progressText(state)}`;
}

/** "1 image downloaded, 3 failed." plus why a run stopped early. */
export function finishedSummaryText({ succeeded, failed, stoppedEarly }: FinishedState): string {
  const outcome =
    failed === 0
      ? `${imagesText(succeeded)} downloaded.`
      : `${imagesText(succeeded)} downloaded, ${formatImageCount(failed)} failed.`;
  return stoppedEarly
    ? `${outcome} The download stopped because the connection seems lost.`
    : outcome;
}

/** "Download cancelled. 250 images downloaded, 1 496 still missing." */
export function cancelledSummaryText({ succeeded, remaining }: CancelledState): string {
  return `Download cancelled. ${imagesText(succeeded)} downloaded, ${formatImageCount(remaining)} still missing.`;
}
