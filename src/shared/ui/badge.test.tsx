import { render, screen } from '@testing-library/react-native';
import { useColorScheme } from 'react-native';

import { Badge } from './badge';
import { darkTheme } from './theme/tokens';

describe('Badge', () => {
  afterEach(() => {
    jest.mocked(useColorScheme).mockReset();
  });

  it('shows its short label', async () => {
    await render(<Badge label="Custom" />);

    expect(screen.getByText('Custom')).toBeOnTheScreen();
  });

  it('is outlined in the accent colour of the theme', async () => {
    jest.mocked(useColorScheme).mockReturnValue('dark');

    await render(<Badge label="Custom" />);

    expect(screen.getByText('Custom')).toHaveStyle({ color: darkTheme.colors.accent });
    expect(screen.getByTestId('badge')).toHaveStyle({ borderColor: darkTheme.colors.accent });
  });
});
