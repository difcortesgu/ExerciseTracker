import type { InstalledApp } from '@shared/domain/installed-app';

import { createToken } from './di/token';

/**
 * Port: identity of the running app build (version name, build number, release vs development).
 *
 * Contract (proven by a shared contract suite in Phase 2, run against the fake and the Expo
 * adapter):
 * - synchronous and side-effect free; the answer never changes during one process;
 * - Expo Go and development bundles report `development`, never a build number;
 * - a release build whose native build number cannot be parsed also reports `development`
 *   (fail-safe: the updater stays inactive rather than offering a wrong update) — the adapter logs
 *   that case as a warning through the Logger port.
 */
export interface InstalledAppInfo {
  getInstalledApp(): InstalledApp;
}

export const InstalledAppInfoToken = createToken<InstalledAppInfo>('shared.InstalledAppInfo');
