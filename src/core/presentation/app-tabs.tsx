import { Tabs } from 'expo-router/js-tabs';
import type { ReactElement } from 'react';

import { useTheme } from '@shared/ui';

/**
 * The app's main sections, in display order. `name` is the route file under `app/(tabs)/`
 * (`index` is the first tab). Adding a section means adding a route file and an entry here.
 */
const TAB_ROUTES = [
  { name: 'index', title: 'Workout' },
  { name: 'routines', title: 'Routines' },
  { name: 'exercises', title: 'Exercises' },
  { name: 'progress', title: 'Progress' },
  { name: 'settings', title: 'Settings' },
] as const;

/** Bottom tab navigator for `app/(tabs)/_layout.tsx`, themed with the shared design tokens. */
export function AppTabs(): ReactElement {
  const { colors, typography } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: typography.tabLabelSize,
          fontWeight: typography.strongWeight,
        },
      }}
    >
      {TAB_ROUTES.map(({ name, title }) => (
        <Tabs.Screen key={name} name={name} options={{ title, tabBarAccessibilityLabel: title }} />
      ))}
    </Tabs>
  );
}
