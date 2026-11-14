import { fireEvent, render, screen } from '@testing-library/react-native';
import { useColorScheme } from 'react-native';

import { darkTheme, lightTheme } from '@shared/ui';

import { MIN_TOUCH_TARGET_SIZE, PRESSED_OPACITY, PromptButton } from './prompt-button';

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

describe('PromptButton', () => {
  afterEach(() => {
    jest.mocked(useColorScheme).mockReset();
  });

  it('is a button named after its label', async () => {
    await render(<PromptButton label="Update" onPress={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Update' })).toHaveTextContent('Update');
  });

  it('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    await render(<PromptButton label="Update" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Update' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is a large touch target for one-handed use mid-workout', async () => {
    await render(<PromptButton label="Update" onPress={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Update' })).toHaveStyle({
      minHeight: MIN_TOUCH_TARGET_SIZE,
    });
    expect(MIN_TOUCH_TARGET_SIZE).toBeGreaterThanOrEqual(48);
  });

  it('dims while pressed, so the tap is visibly registered', async () => {
    await render(<PromptButton label="Update" onPress={() => undefined} />);
    const button = screen.getByRole('button', { name: 'Update' });

    await startTouch(button);

    expect(button).toHaveStyle({ opacity: PRESSED_OPACITY });
  });

  it('fills the primary action with the accent colour and readable text in light mode', async () => {
    jest.mocked(useColorScheme).mockReturnValue('light');

    await render(<PromptButton label="Update" onPress={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Update' })).toHaveStyle({
      backgroundColor: lightTheme.colors.accent,
    });
    expect(screen.getByText('Update')).toHaveStyle({ color: lightTheme.colors.background });
  });

  it('fills the primary action with the accent colour and readable text in dark mode', async () => {
    jest.mocked(useColorScheme).mockReturnValue('dark');

    await render(<PromptButton label="Update" onPress={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Update' })).toHaveStyle({
      backgroundColor: darkTheme.colors.accent,
    });
    expect(screen.getByText('Update')).toHaveStyle({ color: darkTheme.colors.background });
  });

  it('outlines a secondary action in the accent colour so the main action stands out', async () => {
    await render(<PromptButton label="Later" variant="secondary" onPress={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Later' })).toHaveStyle({
      backgroundColor: 'transparent',
      borderColor: lightTheme.colors.accent,
    });
    expect(screen.getByText('Later')).toHaveStyle({ color: lightTheme.colors.accent });
  });
});
