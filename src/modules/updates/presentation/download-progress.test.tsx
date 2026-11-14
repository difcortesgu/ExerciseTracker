import { fireEvent, render, screen } from '@testing-library/react-native';

import { DownloadProgressView } from './download-progress';

async function renderProgress(percent: number) {
  const onCancel = jest.fn();
  await render(
    <DownloadProgressView
      title="Downloading build 42"
      percent={percent}
      amountText="15.8 MB of 35 MB"
      onCancel={onCancel}
    />,
  );
  return { onCancel };
}

describe('DownloadProgressView', () => {
  it('shows what is being downloaded as a heading', async () => {
    await renderProgress(45);

    expect(screen.getByRole('header', { name: 'Downloading build 42' })).toBeOnTheScreen();
  });

  it('shows the progress as a percentage and as bytes of the total', async () => {
    await renderProgress(45);

    expect(screen.getByText('45%')).toBeOnTheScreen();
    expect(screen.getByText('15.8 MB of 35 MB')).toBeOnTheScreen();
  });

  it('announces the progress to screen readers', async () => {
    await renderProgress(45);

    const progressBar = screen.getByRole('progressbar', { name: 'Download progress 45%' });
    expect(progressBar).toHaveAccessibilityValue({ min: 0, max: 100, now: 45 });
  });

  it('fills the progress bar in proportion to the percentage', async () => {
    await renderProgress(45);

    expect(screen.getByTestId('download-progress-fill')).toHaveStyle({ width: '45%' });
  });

  it('cancels the download when Cancel is tapped', async () => {
    const { onCancel } = await renderProgress(45);

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel download' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
