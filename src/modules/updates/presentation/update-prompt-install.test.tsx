import { screen } from '@testing-library/react-native';

import { domainError } from '@shared/domain/domain-error';
import { completeDownload, downloadedApk, press } from '@test/support/update-prompt-harness';

describe('UpdatePrompt: installer hand-off (S05-10)', () => {
  it('explains the "Install unknown apps" step before opening the installer', async () => {
    const { installer } = await completeDownload();

    expect(screen.getByLabelText('Install the update')).toHaveTextContent(/Install unknown apps/);
    expect(installer.opened).toHaveLength(0);
  });

  it('opens the installer for the downloaded APK when the user continues', async () => {
    const { installer } = await completeDownload();

    await press('Open installer');

    expect(installer.opened).toEqual([downloadedApk]);
    expect(screen.getByLabelText("Opening Android's installer")).toBeOnTheScreen();
  });

  it('returns to normal use when the user comes back from the installer', async () => {
    const { installer } = await completeDownload();
    await press('Open installer');

    await installer.returnToApp();

    expect(screen.queryByLabelText("Opening Android's installer")).not.toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
    expect(screen.getByText('Tabs')).toBeOnTheScreen();
  });

  it('lets the user back out from the note without opening the installer', async () => {
    const { installer } = await completeDownload();

    await press('Not now');

    expect(installer.opened).toHaveLength(0);
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('shows an error and downloads again on Retry when the installer cannot be opened', async () => {
    const { installer, downloads } = await completeDownload();
    await press('Open installer');

    await installer.fail(domainError('updates.apkMissing', 'File gone.'));
    expect(screen.getByLabelText('Could not open the installer')).toHaveTextContent(
      /download it again/,
    );
    await press('Retry');

    expect(downloads.attempts).toHaveLength(2);
    expect(screen.getByRole('progressbar', { name: 'Download progress 0%' })).toBeOnTheScreen();
  });
});
