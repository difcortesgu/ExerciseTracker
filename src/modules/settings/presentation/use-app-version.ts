import { useDependency } from '@core/presentation';
import { InstalledAppInfoToken } from '@shared/application/installed-app-info';

import { appVersionLabel } from './app-version-label';

/**
 * View-model hook (MVVM) for the installed build shown in Settings (S05-11). Reads the same
 * `InstalledAppInfo` port as the update check; the answer is constant per process (port
 * contract), so it is read synchronously and needs no loading or error state.
 */
export function useAppVersion(): string {
  return appVersionLabel(useDependency(InstalledAppInfoToken).getInstalledApp());
}
