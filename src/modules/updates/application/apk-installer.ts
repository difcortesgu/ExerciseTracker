import { createToken } from '@shared/application/di/token';
import type { DomainError } from '@shared/domain/domain-error';
import type { Result } from '@shared/domain/result';

import type { DownloadedApk } from './apk-downloader';

export type InstallerErrorCode =
  /** The APK file no longer exists (e.g. the cache was cleared). */
  | 'updates.apkMissing'
  /** Android's package installer could not be opened (details carry the cause). */
  | 'updates.installerUnavailable';

export type InstallerError = DomainError<InstallerErrorCode>;

/**
 * Port: hands a downloaded APK to Android's **system** package installer (S05-10). Never installs
 * silently: Android asks the user to confirm (and, the first time, to allow "Install unknown apps"
 * for Exercise Tracker).
 *
 * Contract:
 * - resolves `ok` when the user returns to the app (installer cancelled, permission declined, or
 *   the installer closed); if the user confirms the install, Android replaces the process and the
 *   promise never settles, which is fine;
 * - every failure to open the installer is an `err`; it never rejects or throws.
 */
export interface ApkInstaller {
  openInstaller(apk: DownloadedApk): Promise<Result<void, InstallerError>>;
}

export const ApkInstallerToken = createToken<ApkInstaller>('updates.ApkInstaller');
