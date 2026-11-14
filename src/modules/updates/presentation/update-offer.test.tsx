import { fireEvent, render, screen } from '@testing-library/react-native';

import { UpdateOffer } from './update-offer';

async function renderOffer() {
  const onUpdate = jest.fn();
  const onLater = jest.fn();
  await render(
    <UpdateOffer title="Build 42 available (35 MB)" onUpdate={onUpdate} onLater={onLater} />,
  );
  return { onUpdate, onLater };
}

describe('UpdateOffer', () => {
  it('shows which build is available as a heading', async () => {
    await renderOffer();

    expect(screen.getByRole('header', { name: 'Build 42 available (35 MB)' })).toBeOnTheScreen();
  });

  it('starts the update when Update is tapped', async () => {
    const { onUpdate, onLater } = await renderOffer();

    await fireEvent.press(screen.getByRole('button', { name: 'Update' }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onLater).not.toHaveBeenCalled();
  });

  it('postpones the update when Later is tapped', async () => {
    const { onUpdate, onLater } = await renderOffer();

    await fireEvent.press(screen.getByRole('button', { name: 'Later' }));

    expect(onLater).toHaveBeenCalledTimes(1);
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
