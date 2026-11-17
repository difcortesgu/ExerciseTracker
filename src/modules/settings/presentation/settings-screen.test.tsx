import { render, screen } from '@testing-library/react-native';

import { createContainer } from '@core/di/container';
import { DependencyProvider } from '@core/presentation';
import {
  ExerciseDataCreditsToken,
  OfflineImagesToken,
  type ExerciseDataCredits,
} from '@modules/exercises';
import { InstalledAppInfoToken } from '@shared/application/installed-app-info';
import type { InstalledApp } from '@shared/domain/installed-app';
import { aDevelopmentInstall, aReleaseInstall } from '@test/builders/installed-app.builder';
import { FakeInstalledAppInfo } from '@test/fakes/fake-installed-app-info';
import { FakeOfflineImages } from '@test/fakes/fake-offline-images';

import { SettingsScreen } from './settings-screen';

/** As registered from the seed manifest (S1-24); the screen must show exactly these values. */
const credits: ExerciseDataCredits = Object.freeze({
  datasetName: 'free-exercise-db',
  repositoryUrl: 'https://github.com/yuhonas/free-exercise-db',
  licenceName: 'The Unlicense (public domain)',
  licenceUrl: 'https://unlicense.org/',
});

function anOfflineImagesService(): FakeOfflineImages {
  const service = new FakeOfflineImages();
  service.givenImages({ cached: 1746, missing: 0, sizeBytes: 1 });
  return service;
}

async function renderSettings(
  installedApp: InstalledApp = aReleaseInstall().build(),
  dataCredits: ExerciseDataCredits = credits,
) {
  const container = createContainer()
    .register(InstalledAppInfoToken, () => new FakeInstalledAppInfo(installedApp))
    .register(OfflineImagesToken, anOfflineImagesService)
    .register(ExerciseDataCreditsToken, () => dataCredits);
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

  describe('offline images (S1-28)', () => {
    it('shows the "Offline images" section of the exercise library', async () => {
      await renderSettings();

      expect(screen.getByRole('header', { name: 'Offline images' })).toBeOnTheScreen();
      expect(screen.getByText('All images are available offline')).toBeOnTheScreen();
    });
  });

  describe('credits (S1-24)', () => {
    it('credits the exercise data and images with their source and licence', async () => {
      await renderSettings();

      expect(screen.getByRole('header', { name: 'Credits' })).toBeOnTheScreen();
      const creditsSection = screen.getByLabelText('Exercise data credits');
      expect(creditsSection).toHaveTextContent(/Exercise data and images: free-exercise-db/);
      expect(creditsSection).toHaveTextContent(/https:\/\/github\.com\/yuhonas\/free-exercise-db/);
      expect(creditsSection).toHaveTextContent(/Licence: The Unlicense \(public domain\)/);
      expect(creditsSection).toHaveTextContent(/https:\/\/unlicense\.org\//);
    });

    it('shows whatever credits are registered, so they exist only next to the seed', async () => {
      const otherPin = { ...credits, datasetName: 'free-exercise-db (fork)', licenceName: 'MIT' };

      await renderSettings(aReleaseInstall().build(), otherPin);

      const creditsSection = screen.getByLabelText('Exercise data credits');
      expect(creditsSection).toHaveTextContent(
        /Exercise data and images: free-exercise-db \(fork\)/,
      );
      expect(creditsSection).toHaveTextContent(/Licence: MIT/);
    });
  });
});
