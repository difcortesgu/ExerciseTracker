import { render, screen } from '@testing-library/react-native';
import { Text, useColorScheme } from 'react-native';

import { Screen } from './screen';
import { darkTheme, lightTheme } from './theme/tokens';

describe('Screen', () => {
  afterEach(() => {
    jest.mocked(useColorScheme).mockReset();
  });

  it('is labelled after its title so it can be found by accessibility label', async () => {
    await render(<Screen title="Routines" />);

    expect(screen.getByLabelText('Routines screen')).toBeOnTheScreen();
  });

  it('shows its title as a heading', async () => {
    await render(<Screen title="Routines" />);

    expect(screen.getByRole('header', { name: 'Routines' })).toBeOnTheScreen();
  });

  it('renders its content below the title', async () => {
    await render(
      <Screen title="Routines">
        <Text>Leg day</Text>
      </Screen>,
    );

    expect(screen.getByLabelText('Routines screen')).toHaveTextContent('RoutinesLeg day');
  });

  it('uses the light background and text colours in light mode', async () => {
    jest.mocked(useColorScheme).mockReturnValue('light');

    await render(<Screen title="Routines" />);

    expect(screen.getByLabelText('Routines screen')).toHaveStyle({
      backgroundColor: lightTheme.colors.background,
    });
    expect(screen.getByRole('header', { name: 'Routines' })).toHaveStyle({
      color: lightTheme.colors.text,
    });
  });

  it('uses the dark background and text colours in dark mode', async () => {
    jest.mocked(useColorScheme).mockReturnValue('dark');

    await render(<Screen title="Routines" />);

    expect(screen.getByLabelText('Routines screen')).toHaveStyle({
      backgroundColor: darkTheme.colors.background,
    });
    expect(screen.getByRole('header', { name: 'Routines' })).toHaveStyle({
      color: darkTheme.colors.text,
    });
  });

  describe('without a title', () => {
    it('renders only its content, with no heading', async () => {
      await render(
        <Screen>
          <Text>Preparing your workouts</Text>
        </Screen>,
      );

      expect(screen.getByText('Preparing your workouts')).toBeOnTheScreen();
      expect(screen.queryByRole('header')).not.toBeOnTheScreen();
    });

    it('still uses the theme background', async () => {
      jest.mocked(useColorScheme).mockReturnValue('dark');

      await render(<Screen />);

      expect(screen.root).toHaveStyle({ backgroundColor: darkTheme.colors.background });
    });
  });
});
