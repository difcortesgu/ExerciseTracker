import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps, ReactElement } from 'react';

import { useTheme } from '@shared/ui';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface TabRoute {
  readonly name: string;
  readonly title: string;
  /** Ionicons glyph for the selected tab (filled) and the others (outlined), S1-05. */
  readonly icon: { readonly focused: IconName; readonly unfocused: IconName };
}

/**
 * The app's main sections, in display order. `name` is the route file under `app/(tabs)/`
 * (`index` is the first tab). Adding a section means adding a route file and an entry here.
 */
const TAB_ROUTES: readonly TabRoute[] = [
  { name: 'index', title: 'Workout', icon: { focused: 'timer', unfocused: 'timer-outline' } },
  { name: 'routines', title: 'Routines', icon: { focused: 'list', unfocused: 'list-outline' } },
  {
    name: 'exercises',
    title: 'Exercises',
    icon: { focused: 'barbell', unfocused: 'barbell-outline' },
  },
  {
    name: 'progress',
    title: 'Progress',
    icon: { focused: 'stats-chart', unfocused: 'stats-chart-outline' },
  },
  {
    name: 'settings',
    title: 'Settings',
    icon: { focused: 'settings', unfocused: 'settings-outline' },
  },
];

interface TabIconProps {
  readonly route: TabRoute;
  readonly focused: boolean;
  /** The active or inactive tint token, the same as the tab label's. */
  readonly color: string;
  readonly size: number;
}

/** Decorative: hidden from screen readers, the tab is announced by its title only. */
function TabIcon({ route, focused, color, size }: TabIconProps): ReactElement {
  return (
    <Ionicons
      testID={`tab-icon-${route.title}`}
      name={focused ? route.icon.focused : route.icon.unfocused}
      color={color}
      size={size}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/** Bottom tab navigator for `app/(tabs)/_layout.tsx`, themed with the shared design tokens. */
export function AppTabs(): ReactElement {
  const { colors, typography } = useTheme();
  const activeTint = colors.accent;
  const inactiveTint = colors.textMuted;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: activeTint,
        tabBarInactiveTintColor: inactiveTint,
        tabBarLabelStyle: {
          fontSize: typography.tabLabelSize,
          fontWeight: typography.strongWeight,
        },
      }}
    >
      {TAB_ROUTES.map((route) => (
        <Tabs.Screen
          key={route.name}
          name={route.name}
          options={{
            title: route.title,
            tabBarAccessibilityLabel: route.title,
            tabBarIcon: ({ focused, size }) => (
              <TabIcon
                route={route}
                focused={focused}
                color={focused ? activeTint : inactiveTint}
                size={size}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
