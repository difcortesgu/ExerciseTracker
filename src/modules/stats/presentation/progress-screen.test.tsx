import { render, screen } from '@testing-library/react-native';

import { ProgressScreen } from './progress-screen';

describe('ProgressScreen', () => {
  it('shows the Progress title', async () => {
    await render(<ProgressScreen />);

    expect(screen.getByLabelText('Progress screen')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Progress' })).toBeOnTheScreen();
  });

  it('shows a coming soon empty state', async () => {
    await render(<ProgressScreen />);

    expect(screen.getByLabelText('Empty state')).toHaveTextContent(/coming soon/i);
  });
});
