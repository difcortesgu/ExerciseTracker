import { aDevelopmentInstall, aReleaseInstall } from '@test/builders/installed-app.builder';

import { appVersionLabel } from './app-version-label';

describe('appVersionLabel', () => {
  it('shows the version and build number of a release build', () => {
    const app = aReleaseInstall().withVersion('0.1.0').withBuildNumber(42).build();

    expect(appVersionLabel(app)).toBe('Version 0.1.0 (build 42)');
  });

  it('says it is a development build instead of a build number', () => {
    const app = aDevelopmentInstall().withVersion('0.2.0').build();

    expect(appVersionLabel(app)).toBe('Version 0.2.0 (development build)');
  });
});
