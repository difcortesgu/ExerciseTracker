import type { ReactElement } from 'react';
import { View } from 'react-native';

import { BodyText } from './body-text';

export interface EmptyStateProps {
  /** Tells the user why there is nothing to show (and, later, what to do about it). */
  readonly message: string;
}

/** Shown when a screen has loaded but has no content. */
export function EmptyState({ message }: EmptyStateProps): ReactElement {
  return (
    <View accessibilityLabel="Empty state">
      <BodyText tone="textMuted">{message}</BodyText>
    </View>
  );
}
