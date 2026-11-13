import { render, screen } from '@testing-library/react-native';

import { RoutinesScreen } from './routines-screen';

describe('RoutinesScreen', () => {
  it('shows the Routines title', async () => {
    await render(<RoutinesScreen />);

    expect(screen.getByLabelText('Routines screen')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Routines' })).toBeOnTheScreen();
  });

  it('shows a coming soon empty state', async () => {
    await render(<RoutinesScreen />);

    expect(screen.getByLabelText('Empty state')).toHaveTextContent(/coming soon/i);
  });
});
