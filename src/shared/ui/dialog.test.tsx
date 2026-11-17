import { fireEvent, render, screen } from '@testing-library/react-native';

import { Dialog } from './dialog';

describe('Dialog', () => {
  it('shows nothing while closed', async () => {
    await render(
      <Dialog visible={false} title="Discard changes?" actions={[]} onDismiss={() => undefined} />,
    );

    expect(screen.queryByRole('header', { name: 'Discard changes?' })).not.toBeOnTheScreen();
  });

  it('shows its title, message and actions while open', async () => {
    await render(
      <Dialog
        visible
        title="Delete 'My Goblet Squat'?"
        message="Its photos are deleted too."
        actions={[
          { label: 'Delete', variant: 'destructive', onPress: () => undefined },
          { label: 'Cancel', variant: 'secondary', onPress: () => undefined },
        ]}
        onDismiss={() => undefined}
      />,
    );

    expect(screen.getByRole('header', { name: "Delete 'My Goblet Squat'?" })).toBeOnTheScreen();
    expect(screen.getByText('Its photos are deleted too.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();
  });

  it('runs the action that is tapped', async () => {
    const onDelete = jest.fn();
    await render(
      <Dialog
        visible
        title="Delete?"
        actions={[{ label: 'Delete', variant: 'destructive', onPress: onDelete }]}
        onDismiss={() => undefined}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("is dismissed by Android's back button", async () => {
    const onDismiss = jest.fn();
    await render(<Dialog visible title="Add photo" actions={[]} onDismiss={onDismiss} />);

    await fireEvent(screen.getByTestId('dialog'), 'requestClose');

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
