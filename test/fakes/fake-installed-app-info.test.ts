import { aDevelopmentInstall, aReleaseInstall } from '@test/builders/installed-app.builder';
import { describeInstalledAppInfoContract } from '@test/contracts/installed-app-info.contract';

import { FakeInstalledAppInfo } from './fake-installed-app-info';

describeInstalledAppInfoContract('FakeInstalledAppInfo', () => ({
  releaseBuild: (version, buildNumber) =>
    new FakeInstalledAppInfo(
      aReleaseInstall().withVersion(version).withBuildNumber(buildNumber).build(),
    ),
  developmentBuild: (version) =>
    new FakeInstalledAppInfo(aDevelopmentInstall().withVersion(version).build()),
}));

describe('FakeInstalledAppInfo', () => {
  it('reports the default release install when constructed without one', () => {
    expect(new FakeInstalledAppInfo().getInstalledApp()).toEqual(aReleaseInstall().build());
  });
});
