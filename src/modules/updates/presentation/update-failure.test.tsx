import { fireEvent, render, screen } from '@testing-library/react-native';

import { UpdateFailure } from './update-failure';

async function renderFailure() {
  const onRetry = jest.fn();
  const onClose = jest.fn();
  await render(
    <UpdateFailure
      title="Download failed"
      message="Check your connection and try again."
      onRetry={onRetry}
      onClose={onClose}
    />,
  );
  return { onRetry, onClose };
}

describe('UpdateFailure', () => {
  it('shows a readable error, labelled with its title', async () => {
    await renderFailure();

    expect(screen.getByLabelText('Download failed')).toHaveTextContent(
      /Check your connection and try again\./,
    );
    expect(screen.getByRole('header', { name: 'Download failed' })).toBeOnTheScreen();
  });

  it('starts again when Retry is tapped', async () => {
    const { onRetry, onClose } = await renderFailure();

    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('gives up when Close is tapped', async () => {
    const { onRetry, onClose } = await renderFailure();

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });
});
