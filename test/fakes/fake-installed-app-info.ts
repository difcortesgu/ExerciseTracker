import type { InstalledAppInfo } from '@shared/application/installed-app-info';
import type { InstalledApp } from '@shared/domain/installed-app';

import { aReleaseInstall } from '../builders/installed-app.builder';

/** Fake `InstalledAppInfo`: reports the install it was given (a release build by default). */
export class FakeInstalledAppInfo implements InstalledAppInfo {
  constructor(private readonly installed: InstalledApp = aReleaseInstall().build()) {}

  getInstalledApp(): InstalledApp {
    return this.installed;
  }
}
