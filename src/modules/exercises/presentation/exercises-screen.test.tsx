import { render, screen } from '@testing-library/react-native';

import { ExercisesScreen } from './exercises-screen';

describe('ExercisesScreen', () => {
  it('shows the Exercises title', async () => {
    await render(<ExercisesScreen />);

    expect(screen.getByLabelText('Exercises screen')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Exercises' })).toBeOnTheScreen();
  });

  it('shows a coming soon empty state', async () => {
    await render(<ExercisesScreen />);

    expect(screen.getByLabelText('Empty state')).toHaveTextContent(/coming soon/i);
  });
});
