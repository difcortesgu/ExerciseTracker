import type { ReactElement } from 'react';
import { View } from 'react-native';

import { BodyText } from './body-text';
import { Button } from './button';
import { useTheme } from './theme/use-theme';

export interface EmptyStateAction {
  readonly label: string;
  readonly onPress: () => void;
}

export interface EmptyStateProps {
  /** Tells the user why there is nothing to show (and, later, what to do about it). */
  readonly message: string;
  /** Optional way out, e.g. "Clear filters"; shown as a secondary button. */
  readonly action?: EmptyStateAction;
}

/** Shown when a screen has loaded but has no content. */
export function EmptyState({ message, action }: EmptyStateProps): ReactElement {
  const { spacing } = useTheme();

  return (
    <View accessibilityLabel="Empty state" style={{ gap: spacing.medium }}>
      <BodyText tone="textMuted">{message}</BodyText>
      {action === undefined ? null : (
        <Button label={action.label} variant="secondary" onPress={action.onPress} />
      )}
    </View>
  );
}
