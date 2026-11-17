import type { ReactElement } from 'react';
import { ScrollView, View } from 'react-native';

import { OfflineImagesSection } from '@modules/exercises';
import { BodyText, EmptyState, Screen, useTheme } from '@shared/ui';

import { DataCreditsSection } from './data-credits-section';
import { useAppVersion } from './use-app-version';

/**
 * Settings tab: settings are coming soon; offers the offline images of the exercise library
 * (S1-28), credits the exercise data (S1-24) and shows the installed build (S05-11).
 */
export function SettingsScreen(): ReactElement {
  const appVersion = useAppVersion();
  const { spacing } = useTheme();

  return (
    <Screen title="Settings">
      <ScrollView contentContainerStyle={{ flexGrow: 1, gap: spacing.large }}>
        <EmptyState message="Choose units, sounds and theme. Coming soon." />
        <OfflineImagesSection />
        <DataCreditsSection />
        <View accessibilityLabel="App version" style={{ marginTop: 'auto' }}>
          <BodyText tone="textMuted">{appVersion}</BodyText>
        </View>
      </ScrollView>
    </Screen>
  );
}
