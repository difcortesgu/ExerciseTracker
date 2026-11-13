import type { ReactElement } from 'react';
import { View } from 'react-native';

import { BodyText } from './body-text';
import { Heading } from './heading';
import { useTheme } from './theme/use-theme';

export interface ErrorStateProps {
  /** Short summary; shown as a heading and used as the accessibility label. */
  readonly title: string;
  /** Readable explanation of what went wrong. */
  readonly message: string;
}

/** Shown when a screen cannot show its content because something failed. */
export function ErrorState({ title, message }: ErrorStateProps): ReactElement {
  const { spacing } = useTheme();

  return (
    <View accessibilityLabel={title} style={{ gap: spacing.small }}>
      <Heading>{title}</Heading>
      <BodyText>{message}</BodyText>
    </View>
  );
}
