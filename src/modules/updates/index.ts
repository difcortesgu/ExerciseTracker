/**
 * Public API of the `updates` module (Sprint 0.5, self-update; ADR-003). Other modules, `app/`
 * routes and the composition root may import this module only through this file (enforced by
 * eslint-plugin-boundaries).
 *
 * Rules (docs/ENGINEERING_STANDARDS.md §1.3, ADR-001):
 * - Re-exports only (`export … from`); no logic here (enforced by lint).
 * - Export use cases, DTOs, port interfaces, DI tokens and presentation screens.
 * - Never export infrastructure adapters; they are wired in `src/core/di` only.
 */

// Domain: release model and update decision (S05-05)
export type {
  ApkAsset,
  HttpsUrl,
  PublishedRelease,
  PublishedReleaseAsset,
  Release,
  ReleaseError,
  ReleaseErrorCode,
} from './domain/release';
export type { UpdateDecision } from './domain/update-decision';

// Application: ports (S05-07, S05-09, S05-10)
export {
  ReleaseSourceToken,
  type ReleaseSource,
  type ReleaseSourceError,
  type ReleaseSourceErrorCode,
} from './application/release-source';
export {
  ApkDownloaderToken,
  type ApkDownloader,
  type DownloadedApk,
  type DownloadError,
  type DownloadErrorCode,
  type DownloadProgress,
  type DownloadRequest,
  type DownloadTask,
} from './application/apk-downloader';
export {
  ApkInstallerToken,
  type ApkInstaller,
  type InstallerError,
  type InstallerErrorCode,
} from './application/apk-installer';

// Application: use cases (S05-06, S05-09, S05-10)
export {
  CheckForUpdateToken,
  type CheckForUpdate,
  type UpdateCheckError,
  type UpdateCheckOutcome,
} from './application/check-for-update';
export { DownloadUpdateToken, type DownloadUpdate } from './application/download-update';
export { InstallUpdateToken, type InstallUpdate } from './application/install-update';
export {
  UpdateOfferDismissalToken,
  type UpdateOfferDismissal,
} from './application/update-offer-dismissal';

// Presentation: startup update prompt (S05-08 to S05-10); rendered by app/_layout.tsx
export { UpdatePrompt } from './presentation/update-prompt';
