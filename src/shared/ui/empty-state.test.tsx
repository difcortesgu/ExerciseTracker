import { fireEvent, render, screen } from '@testing-library/react-native';
import { useColorScheme } from 'react-native';

import { EmptyState } from './empty-state';
import { darkTheme, lightTheme } from './theme/tokens';

describe('EmptyState', () => {
  afterEach(() => {
    jest.mocked(useColorScheme).mockReset();
  });

  it('is labelled as an empty state and tells the user why there is nothing to show', async () => {
    await render(<EmptyState message="No routines yet." />);

    expect(screen.getByLabelText('Empty state')).toHaveTextContent('No routines yet.');
  });

  it('shows its message in the muted text colour of the light theme', async () => {
    jest.mocked(useColorScheme).mockReturnValue('light');

    await render(<EmptyState message="No routines yet." />);

    expect(screen.getByText('No routines yet.')).toHaveStyle({
      color: lightTheme.colors.textMuted,
      fontSize: lightTheme.typography.bodySize,
    });
  });

  it('shows its message in the muted text colour of the dark theme', async () => {
    jest.mocked(useColorScheme).mockReturnValue('dark');

    await render(<EmptyState message="No routines yet." />);

    expect(screen.getByText('No routines yet.')).toHaveStyle({
      color: darkTheme.colors.textMuted,
    });
  });

  it('offers no action unless one is given', async () => {
    await render(<EmptyState message="No exercises match." />);

    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('offers an action that helps the user out of the empty state', async () => {
    const onPress = jest.fn();
    await render(
      <EmptyState message="No exercises match." action={{ label: 'Clear filters', onPress }} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Clear filters' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
