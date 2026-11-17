import { fireEvent, render, screen } from '@testing-library/react-native';

import { ErrorState } from './error-state';

describe('ErrorState', () => {
  it('is labelled with its title and contains the message', async () => {
    await render(<ErrorState title="Could not load routines" message="The database is locked." />);

    expect(screen.getByLabelText('Could not load routines')).toHaveTextContent(
      'Could not load routinesThe database is locked.',
    );
  });

  it('shows the title as a heading and the readable error message', async () => {
    await render(<ErrorState title="Could not load routines" message="The database is locked." />);

    expect(screen.getByRole('header', { name: 'Could not load routines' })).toBeOnTheScreen();
    expect(screen.getByText('The database is locked.')).toBeOnTheScreen();
  });

  it('announces itself politely to screen readers when it appears inside a screen (S1-07)', async () => {
    await render(<ErrorState title="Could not load exercises" message="Storage failed." />);

    expect(screen.getByLabelText('Could not load exercises').props.accessibilityLiveRegion).toBe(
      'polite',
    );
  });

  it('offers no Retry when no retry action is given', async () => {
    await render(<ErrorState title="Startup failed" message="Migration failed." />);

    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeOnTheScreen();
  });

  it('offers a Retry button that runs the retry action', async () => {
    const onRetry = jest.fn();
    await render(
      <ErrorState title="Could not load exercises" message="Storage failed." onRetry={onRetry} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
