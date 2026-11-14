import type { InstalledApp } from '@shared/domain/installed-app';

/** "Version 0.1.0 (build 42)", or "(development build)" in Expo Go / a development build. */
export function appVersionLabel(app: InstalledApp): string {
  const build = app.kind === 'release' ? `build ${app.buildNumber}` : 'development build';
  return `Version ${app.version} (${build})`;
}
