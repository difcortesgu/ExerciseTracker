import { render, screen } from '@testing-library/react-native';

import { createContainer } from '@core/di/container';
import { DependencyProvider } from '@core/presentation';
import { InstalledAppInfoToken } from '@shared/application/installed-app-info';
import type { InstalledApp } from '@shared/domain/installed-app';
import { aDevelopmentInstall, aReleaseInstall } from '@test/builders/installed-app.builder';
import { FakeInstalledAppInfo } from '@test/fakes/fake-installed-app-info';

import { SettingsScreen } from './settings-screen';

async function renderSettings(installedApp: InstalledApp = aReleaseInstall().build()) {
  const container = createContainer().register(
    InstalledAppInfoToken,
    () => new FakeInstalledAppInfo(installedApp),
  );
  await render(
    <DependencyProvider resolver={container}>
      <SettingsScreen />
    </DependencyProvider>,
  );
}

describe('SettingsScreen', () => {
  it('shows the Settings title', async () => {
    await renderSettings();

    expect(screen.getByLabelText('Settings screen')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Settings' })).toBeOnTheScreen();
  });

  it('shows a coming soon empty state', async () => {
    await renderSettings();

    expect(screen.getByLabelText('Empty state')).toHaveTextContent(/coming soon/i);
  });

  describe('installed build (S05-11)', () => {
    it('shows the version and build number of a release build', async () => {
      await renderSettings(aReleaseInstall().withVersion('0.1.0').withBuildNumber(42).build());

      expect(screen.getByLabelText('App version')).toHaveTextContent('Version 0.1.0 (build 42)');
    });

    it('says it is a development build in Expo Go or a development build', async () => {
      await renderSettings(aDevelopmentInstall().withVersion('0.1.0').build());

      expect(screen.getByLabelText('App version')).toHaveTextContent(
        'Version 0.1.0 (development build)',
      );
    });
  });
});
