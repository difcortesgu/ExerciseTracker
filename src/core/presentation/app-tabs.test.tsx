import { isHiddenFromAccessibility, within } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { lightTheme } from '@shared/ui';

import { AppTabs } from './app-tabs';

const TAB_NAMES = ['Workout', 'Routines', 'Exercises', 'Progress', 'Settings'] as const;

function placeholder(name: string) {
  return function PlaceholderRoute() {
    return <Text>{`${name} content`}</Text>;
  };
}

async function renderTabs(): Promise<void> {
  await renderRouter(
    {
      '(tabs)/_layout': AppTabs,
      '(tabs)/index': placeholder('Workout'),
      '(tabs)/routines': placeholder('Routines'),
      '(tabs)/exercises': placeholder('Exercises'),
      '(tabs)/progress': placeholder('Progress'),
      '(tabs)/settings': placeholder('Settings'),
    },
    { initialUrl: '/' },
  );
}

describe('AppTabs', () => {
  it('shows exactly five tabs in the agreed order', async () => {
    await renderTabs();

    const tabLabels = screen
      .getAllByRole('button')
      .map((tab) => tab.props.accessibilityLabel as unknown);

    expect(tabLabels).toEqual(TAB_NAMES);
  });

  it('shows the tab labels in the theme label size and strong weight', async () => {
    await renderTabs();

    expect(screen.getByText('Routines')).toHaveStyle({
      fontSize: lightTheme.typography.tabLabelSize,
      fontWeight: lightTheme.typography.strongWeight,
    });
  });

  it('opens on the Workout tab', async () => {
    await renderTabs();

    expect(screen.getByText('Workout content')).toBeOnTheScreen();
  });

  it.each(TAB_NAMES)('shows the %s screen when its tab is pressed', async (tabName) => {
    await renderTabs();

    await fireEvent.press(screen.getByLabelText(tabName));

    expect(await screen.findByText(`${tabName} content`)).toBeOnTheScreen();
  });

  describe('icons (S1-05)', () => {
    it.each(TAB_NAMES)('shows an icon in the %s tab', async (tabName) => {
      await renderTabs();

      expect(shownIcon(tabName)).toBeOnTheScreen();
    });

    it('keeps the icon out of the screen reader, so a tab is announced by its name only', async () => {
      await renderTabs();

      expect(isHiddenFromAccessibility(shownIcon('Exercises'))).toBe(true);
      expect(screen.getByLabelText('Exercises')).toBeOnTheScreen();
    });

    it('colours the selected tab icon with the active token and the others with the inactive token', async () => {
      await renderTabs();

      expect(shownIcon('Workout')).toHaveStyle({ color: lightTheme.colors.accent });
      expect(shownIcon('Settings')).toHaveStyle({ color: lightTheme.colors.textMuted });
    });

    it('moves the active colour to the tab the user selects', async () => {
      await renderTabs();

      await fireEvent.press(screen.getByLabelText('Exercises'));

      expect(await screen.findByText('Exercises content')).toBeOnTheScreen();
      expect(shownIcon('Exercises')).toHaveStyle({ color: lightTheme.colors.accent });
      expect(shownIcon('Workout')).toHaveStyle({ color: lightTheme.colors.textMuted });
    });
  });
});

type HostElement = ReturnType<typeof screen.getByLabelText>;

function isFadedOut(element: HostElement | null): boolean {
  if (element === null) {
    return false;
  }
  return StyleSheet.flatten(element.props.style)?.opacity === 0 || isFadedOut(element.parent);
}

/**
 * The tab bar draws a selected and an unselected icon on top of each other and fades one of them
 * out; this returns the one the user sees.
 */
function shownIcon(tabName: string): HostElement {
  const icons = within(screen.getByLabelText(tabName)).getAllByTestId(`tab-icon-${tabName}`, {
    includeHiddenElements: true,
  });
  const [shown, ...others] = icons.filter((icon) => !isFadedOut(icon));
  if (shown === undefined || others.length > 0) {
    throw new Error(`Expected exactly one visible icon in the ${tabName} tab.`);
  }
  return shown;
}
