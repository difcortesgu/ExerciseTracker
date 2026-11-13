import { render, screen } from '@testing-library/react-native';

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
});
