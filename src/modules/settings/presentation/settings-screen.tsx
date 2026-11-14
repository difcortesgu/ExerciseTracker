import type { ReactElement } from 'react';
import { View } from 'react-native';

import { BodyText, EmptyState, Screen } from '@shared/ui';

import { useAppVersion } from './use-app-version';

/** Settings tab: settings are coming soon; shows the installed build (S05-11). */
export function SettingsScreen(): ReactElement {
  const appVersion = useAppVersion();

  return (
    <Screen title="Settings">
      <EmptyState message="Choose units, sounds and theme. Coming soon." />
      <View accessibilityLabel="App version" style={{ marginTop: 'auto' }}>
        <BodyText tone="textMuted">{appVersion}</BodyText>
      </View>
    </Screen>
  );
}
