import { Text } from 'react-native';
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
});
