import type {
  ApkDownloader,
  DownloadedApk,
  DownloadError,
  DownloadErrorCode,
  DownloadRequest,
  DownloadTask,
} from '@modules/updates/application/apk-downloader';
import { domainError } from '@shared/domain/domain-error';
import { err, ok, type Result } from '@shared/domain/result';

/** Where the fake "stores" the APK: one fixed file, like the real adapter. */
export const FAKE_APK_FILE_URI = 'file:///data/cache/updates/update.apk';

type Behaviour =
  | { readonly kind: 'deliver'; readonly sizeBytes: number | 'expected' }
  | { readonly kind: 'fail' }
  | { readonly kind: 'hold' };

type DownloadResult = Result<DownloadedApk, DownloadError>;

/** Controls of the latest held download; inert once it settled. */
interface HeldDownload {
  readonly request: DownloadRequest;
  readonly isSettled: () => boolean;
  readonly settle: (outcome: () => DownloadResult) => void;
}

const failure = (code: DownloadErrorCode): DownloadResult =>
  err(domainError(code, `Fake download: ${code}.`));

/**
 * Fake `ApkDownloader`: no network or file system. Delivers the expected size by default (progress
 * at half and at the end, asynchronously); tests can make it deliver another size, fail, or hold
 * the download and step it by hand (`emitProgress`, `completeHeldDownload`, `failHeldDownload`)
 * until it settles or is cancelled. Tracks whether "the" APK file exists.
 */
export class FakeApkDownloader implements ApkDownloader {
  private behaviour: Behaviour = { kind: 'deliver', sizeBytes: 'expected' };
  private stored = false;
  private recorded: readonly DownloadRequest[] = [];
  private held: HeldDownload | undefined;

  get requests(): readonly DownloadRequest[] {
    return this.recorded;
  }

  get storedApkExists(): boolean {
    return this.stored;
  }

  deliver(sizeBytes: number): void {
    this.behaviour = { kind: 'deliver', sizeBytes };
  }

  failDownloads(): void {
    this.behaviour = { kind: 'fail' };
  }

  holdDownloads(): void {
    this.behaviour = { kind: 'hold' };
  }

  storeStaleApk(): void {
    this.stored = true;
  }

  /** Reports progress of the held download (`totalBytes` = its expected size). */
  emitProgress(receivedBytes: number): void {
    const held = this.held;
    if (held === undefined || held.isSettled()) return;
    held.request.onProgress({ receivedBytes, totalBytes: held.request.expectedSizeBytes });
  }

  /** Completes the held download with a file of exactly the expected size. */
  completeHeldDownload(): void {
    const held = this.held;
    held?.settle(() =>
      ok({ fileUri: FAKE_APK_FILE_URI, sizeBytes: held.request.expectedSizeBytes }),
    );
  }

  failHeldDownload(code: Exclude<DownloadErrorCode, 'updates.downloadCancelled'>): void {
    this.held?.settle(() => failure(code));
  }

  start(request: DownloadRequest): DownloadTask {
    this.recorded = [...this.recorded, request];
    this.stored = false;
    let settled = false;
    let resolveResult: (result: DownloadResult) => void = () => undefined;
    const result = new Promise<DownloadResult>((resolve) => {
      resolveResult = resolve;
    });
    const settle = (outcome: () => DownloadResult): void => {
      if (settled) return;
      settled = true;
      const value = outcome();
      this.stored = value.ok;
      resolveResult(value);
    };
    const behaviour = this.behaviour;
    if (behaviour.kind === 'hold') {
      this.held = { request, isSettled: () => settled, settle };
    } else {
      void Promise.resolve().then(() => settle(() => this.run(behaviour, request)));
    }
    return { result, cancel: () => settle(() => failure('updates.downloadCancelled')) };
  }

  private run(
    behaviour: Exclude<Behaviour, { kind: 'hold' }>,
    request: DownloadRequest,
  ): DownloadResult {
    if (behaviour.kind === 'fail') {
      return failure('updates.downloadFailed');
    }
    const sizeBytes =
      behaviour.sizeBytes === 'expected' ? request.expectedSizeBytes : behaviour.sizeBytes;
    const totalBytes = request.expectedSizeBytes;
    request.onProgress({ receivedBytes: Math.floor(sizeBytes / 2), totalBytes });
    request.onProgress({ receivedBytes: sizeBytes, totalBytes });
    return sizeBytes === request.expectedSizeBytes
      ? ok({ fileUri: FAKE_APK_FILE_URI, sizeBytes })
      : failure('updates.downloadSizeMismatch');
  }
}
