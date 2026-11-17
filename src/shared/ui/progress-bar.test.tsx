import { render, screen } from '@testing-library/react-native';
import { useColorScheme } from 'react-native';

import { ProgressBar } from './progress-bar';
import { darkTheme } from './theme/tokens';

describe('ProgressBar', () => {
  afterEach(() => {
    jest.mocked(useColorScheme).mockReset();
  });

  it('is a progress bar announced with its label and value', async () => {
    await render(
      <ProgressBar label="Image download progress, 250 of 1 746" value={250} max={1746} />,
    );

    expect(
      screen.getByRole('progressbar', { name: 'Image download progress, 250 of 1 746' }),
    ).toHaveAccessibilityValue({ min: 0, max: 1746, now: 250 });
  });

  it('fills in proportion to the value', async () => {
    await render(<ProgressBar label="Progress" value={1} max={4} fillTestID="fill" />);

    expect(screen.getByTestId('fill')).toHaveStyle({ width: '25%' });
  });

  it('stays empty when there is nothing to do yet, never dividing by zero', async () => {
    await render(<ProgressBar label="Progress" value={0} max={0} fillTestID="fill" />);

    expect(screen.getByTestId('fill')).toHaveStyle({ width: '0%' });
  });

  it('never overflows when the value exceeds the maximum', async () => {
    await render(<ProgressBar label="Progress" value={5} max={4} fillTestID="fill" />);

    expect(screen.getByTestId('fill')).toHaveStyle({ width: '100%' });
  });

  it('fills with the accent colour of the theme', async () => {
    jest.mocked(useColorScheme).mockReturnValue('dark');

    await render(<ProgressBar label="Progress" value={1} max={2} fillTestID="fill" />);

    expect(screen.getByTestId('fill')).toHaveStyle({ backgroundColor: darkTheme.colors.accent });
  });
});
