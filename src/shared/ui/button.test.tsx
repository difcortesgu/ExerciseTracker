import { fireEvent, render, screen } from '@testing-library/react-native';
import { useColorScheme } from 'react-native';

import { Button } from './button';
import { darkTheme, lightTheme } from './theme/tokens';

/**
 * Puts a finger down without lifting it: the touch-start (`responderGrant`) event the native
 * responder system sends, as RNTL's `userEvent` does internally. `fireEvent.press` would release
 * immediately, so the pressed state could not be observed.
 */
const startTouch = (element: ReturnType<typeof screen.getByRole>) =>
  fireEvent(element, 'responderGrant', {
    nativeEvent: { timestamp: 0, touches: [], changedTouches: [] },
    persist: () => undefined,
    currentTarget: { measure: () => undefined },
  });

const { interaction } = lightTheme;

describe('Button', () => {
  afterEach(() => {
    jest.mocked(useColorScheme).mockReset();
  });

  it('is a button named after its label', async () => {
    await render(<Button label="Save" onPress={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Save' })).toHaveTextContent('Save');
  });

  it('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is a large touch target for one-handed use mid-workout', async () => {
    await render(<Button label="Save" onPress={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Save' })).toHaveStyle({
      minHeight: interaction.minTouchTargetSize,
      minWidth: interaction.minTouchTargetSize,
    });
    expect(interaction.minTouchTargetSize).toBeGreaterThanOrEqual(48);
  });

  it('dims while pressed, so the tap is visibly registered', async () => {
    await render(<Button label="Save" onPress={() => undefined} />);
    const button = screen.getByRole('button', { name: 'Save' });

    await startTouch(button);

    expect(button).toHaveStyle({ opacity: interaction.pressedOpacity });
  });

  it('fills the primary action with the accent colour and readable text in light mode', async () => {
    jest.mocked(useColorScheme).mockReturnValue('light');

    await render(<Button label="Save" onPress={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Save' })).toHaveStyle({
      backgroundColor: lightTheme.colors.accent,
    });
    expect(screen.getByText('Save')).toHaveStyle({ color: lightTheme.colors.background });
  });

  it('fills the primary action with the accent colour and readable text in dark mode', async () => {
    jest.mocked(useColorScheme).mockReturnValue('dark');

    await render(<Button label="Save" onPress={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Save' })).toHaveStyle({
      backgroundColor: darkTheme.colors.accent,
    });
    expect(screen.getByText('Save')).toHaveStyle({ color: darkTheme.colors.background });
  });

  it('outlines a secondary action in the accent colour so the main action stands out', async () => {
    await render(<Button label="Later" variant="secondary" onPress={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Later' })).toHaveStyle({
      backgroundColor: 'transparent',
      borderColor: lightTheme.colors.accent,
    });
    expect(screen.getByText('Later')).toHaveStyle({ color: lightTheme.colors.accent });
  });

  it('fills a destructive action with the danger colour', async () => {
    jest.mocked(useColorScheme).mockReturnValue('dark');

    await render(<Button label="Delete" variant="destructive" onPress={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Delete' })).toHaveStyle({
      backgroundColor: darkTheme.colors.danger,
      borderColor: darkTheme.colors.danger,
    });
    expect(screen.getByText('Delete')).toHaveStyle({ color: darkTheme.colors.background });
  });

  describe('when disabled', () => {
    it('cannot be pressed', async () => {
      const onPress = jest.fn();
      await render(<Button label="Add photo" disabled onPress={onPress} />);

      await fireEvent.press(screen.getByRole('button', { name: 'Add photo' }));

      expect(onPress).not.toHaveBeenCalled();
    });

    it('is announced as disabled', async () => {
      await render(<Button label="Add photo" disabled onPress={() => undefined} />);

      expect(screen.getByRole('button', { name: 'Add photo' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Add photo' }).props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: true }),
      );
    });

    it('keeps the minimum touch target and looks dimmed', async () => {
      await render(<Button label="Add photo" disabled onPress={() => undefined} />);

      expect(screen.getByRole('button', { name: 'Add photo' })).toHaveStyle({
        minHeight: interaction.minTouchTargetSize,
        opacity: interaction.disabledOpacity,
      });
    });
  });

  it('is announced as enabled by default', async () => {
    await render(<Button label="Save" onPress={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});
