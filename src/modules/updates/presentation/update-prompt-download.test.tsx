import { screen } from '@testing-library/react-native';

import { domainError } from '@shared/domain/domain-error';
import { err } from '@shared/domain/result';
import {
  MEBIBYTE,
  offeredRelease,
  press,
  startDownload,
} from '@test/support/update-prompt-harness';

import type { DownloadError } from '../application/apk-downloader';

const halfwayProgress = { receivedBytes: 14 * MEBIBYTE, totalBytes: 35 * MEBIBYTE };

describe('UpdatePrompt: download (S05-09)', () => {
  it('downloads the offered release and shows its progress from 0%', async () => {
    const { downloads } = await startDownload();

    expect(downloads.latest().release).toBe(offeredRelease);
    expect(screen.getByRole('header', { name: 'Downloading build 42' })).toBeOnTheScreen();
    expect(screen.getByRole('progressbar', { name: 'Download progress 0%' })).toBeOnTheScreen();
  });

  it('updates the progress as data arrives', async () => {
    const { downloads } = await startDownload();

    await downloads.latest().progress(halfwayProgress);

    expect(screen.getByRole('progressbar', { name: 'Download progress 40%' })).toBeOnTheScreen();
    expect(screen.getByText('14 MB of 35 MB')).toBeOnTheScreen();
  });

  it('stops the download and returns to normal use when the user cancels', async () => {
    const { downloads } = await startDownload();

    await press('Cancel download');

    expect(downloads.latest().isCancelled()).toBe(true);
    expect(screen.queryByRole('progressbar')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
    expect(screen.getByText('Tabs')).toBeOnTheScreen();
  });

  it.each<[DownloadError, RegExp]>([
    [domainError('updates.downloadFailed', 'Network lost.'), /Check your connection/],
    [domainError('updates.downloadSizeMismatch', 'Size differs.'), /incomplete/],
  ])(
    'shows a readable error with Retry and Close when the download fails (%#)',
    async (error, message) => {
      const { downloads } = await startDownload();

      await downloads.latest().settle(err(error));

      expect(screen.getByLabelText('Download failed')).toHaveTextContent(message);
      expect(screen.getByRole('button', { name: 'Retry' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Close' })).toBeOnTheScreen();
    },
  );

  it('starts the download again from zero on Retry', async () => {
    const { downloads } = await startDownload();
    await downloads.latest().progress(halfwayProgress);
    await downloads.latest().settle(err(domainError('updates.downloadFailed', 'Lost.')));

    await press('Retry');

    expect(downloads.attempts).toHaveLength(2);
    expect(screen.getByRole('progressbar', { name: 'Download progress 0%' })).toBeOnTheScreen();
  });

  it('keeps the app usable after Close', async () => {
    const { downloads } = await startDownload();
    await downloads.latest().settle(err(domainError('updates.downloadFailed', 'Lost.')));

    await press('Close');

    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
    expect(screen.getByText('Tabs')).toBeOnTheScreen();
  });

  it('cancels a running download when the prompt goes away', async () => {
    const { downloads, view } = await startDownload();

    await view.unmount();

    expect(downloads.latest().isCancelled()).toBe(true);
  });
});
