import type { ReactElement } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { BodyText } from './body-text';
import { useTheme } from './theme/use-theme';

export interface LoadingStateProps {
  /** Says what is loading; shown and used as the accessibility label. */
  readonly label: string;
}

/** Shown while a screen waits for its data, so the user never sees a blank screen. */
export function LoadingState({ label }: LoadingStateProps): ReactElement {
  const { colors, spacing } = useTheme();

  return (
    <View
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.medium }}
    >
      <ActivityIndicator size="large" color={colors.accent} />
      <BodyText>{label}</BodyText>
    </View>
  );
}
