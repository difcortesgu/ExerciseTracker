import { render, screen } from '@testing-library/react-native';

import { WorkoutScreen } from './workout-screen';

describe('WorkoutScreen', () => {
  it('shows the Workout title', async () => {
    await render(<WorkoutScreen />);

    expect(screen.getByLabelText('Workout screen')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Workout' })).toBeOnTheScreen();
  });

  it('shows a coming soon empty state', async () => {
    await render(<WorkoutScreen />);

    expect(screen.getByLabelText('Empty state')).toHaveTextContent(/coming soon/i);
  });
});
