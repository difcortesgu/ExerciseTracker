import { render, screen } from '@testing-library/react-native';

import { SettingsScreen } from './settings-screen';

describe('SettingsScreen', () => {
  it('shows the Settings title', async () => {
    await render(<SettingsScreen />);

    expect(screen.getByLabelText('Settings screen')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Settings' })).toBeOnTheScreen();
  });

  it('shows a coming soon empty state', async () => {
    await render(<SettingsScreen />);

    expect(screen.getByLabelText('Empty state')).toHaveTextContent(/coming soon/i);
  });
});
