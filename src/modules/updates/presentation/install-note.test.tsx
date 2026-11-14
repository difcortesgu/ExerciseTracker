import { fireEvent, render, screen } from '@testing-library/react-native';

import { InstallNote } from './install-note';

async function renderNote() {
  const onContinue = jest.fn();
  const onCancel = jest.fn();
  await render(<InstallNote onContinue={onContinue} onCancel={onCancel} />);
  return { onContinue, onCancel };
}

describe('InstallNote', () => {
  it('explains the "Install unknown apps" step before handing off to Android', async () => {
    await renderNote();

    expect(screen.getByRole('header', { name: 'Install the update' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Install the update')).toHaveTextContent(/Install unknown apps/);
  });

  it('opens the installer when the user continues', async () => {
    const { onContinue, onCancel } = await renderNote();

    await fireEvent.press(screen.getByRole('button', { name: 'Open installer' }));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('lets the user back out', async () => {
    const { onContinue, onCancel } = await renderNote();

    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
  });
});
