import { parseBuildNumber, type BuildNumber } from '@shared/domain/build-number';
import type { DevelopmentInstall, ReleaseInstall } from '@shared/domain/installed-app';

import { unwrap } from '../support/unwrap';

/**
 * Builders for "which build is running" (Sprint 0.5). Branded values are created through the
 * domain factory only, never by casting.
 */

const DEFAULT_VERSION = '0.1.0';
/** One below the default release of `aRelease()`, so the defaults describe "update available". */
const DEFAULT_INSTALLED_BUILD = 41;

/** A valid `BuildNumber` (throws for an invalid one, failing the test loudly). */
export const aBuildNumber = (value: number): BuildNumber => unwrap(parseBuildNumber(value));

export class ReleaseInstallBuilder {
  constructor(
    private readonly version: string,
    private readonly buildNumber: BuildNumber,
  ) {}

  withVersion(version: string): ReleaseInstallBuilder {
    return new ReleaseInstallBuilder(version, this.buildNumber);
  }

  withBuildNumber(buildNumber: number): ReleaseInstallBuilder {
    return new ReleaseInstallBuilder(this.version, aBuildNumber(buildNumber));
  }

  build(): ReleaseInstall {
    return { kind: 'release', version: this.version, buildNumber: this.buildNumber };
  }
}

export class DevelopmentInstallBuilder {
  constructor(private readonly version: string) {}

  withVersion(version: string): DevelopmentInstallBuilder {
    return new DevelopmentInstallBuilder(version);
  }

  build(): DevelopmentInstall {
    return { kind: 'development', version: this.version };
  }
}

export const aReleaseInstall = (): ReleaseInstallBuilder =>
  new ReleaseInstallBuilder(DEFAULT_VERSION, aBuildNumber(DEFAULT_INSTALLED_BUILD));

export const aDevelopmentInstall = (): DevelopmentInstallBuilder =>
  new DevelopmentInstallBuilder(DEFAULT_VERSION);
