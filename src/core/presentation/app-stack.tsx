import { Stack } from 'expo-router';
import type { ReactElement } from 'react';

import { useTheme } from '@shared/ui';

/** The tab navigator's route group (`app/(tabs)/`): the first screen, without a stack header. */
const TABS_ROUTE = '(tabs)';

/**
 * Root navigator for `app/_layout.tsx` (ADR-001 §13): the tabs are the first screen, and screens
 * that open on top of them (exercise detail, create and edit forms) are pushed onto this stack
 * with a themed header and back action. The tabs stay mounted underneath, so their state (search
 * text, filters, scroll position) survives a round trip through a stack screen.
 */
export function AppStack(): ReactElement {
  const { colors, typography } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: typography.strongWeight },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name={TABS_ROUTE} options={{ headerShown: false }} />
    </Stack>
  );
}
