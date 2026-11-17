import type { ReactElement } from 'react';
import { View } from 'react-native';

import { BodyText } from './body-text';
import { Button } from './button';
import { Heading } from './heading';
import { useTheme } from './theme/use-theme';

const RETRY_LABEL = 'Retry';

export interface ErrorStateProps {
  /** Short summary; shown as a heading and used as the accessibility label. */
  readonly title: string;
  /** Readable explanation of what went wrong. */
  readonly message: string;
  /** When given, a "Retry" button runs it (e.g. load the list again). */
  readonly onRetry?: () => void;
}

/**
 * Shown when a screen cannot show its content because something failed.
 *
 * It is a **polite** live region (S1-07): when it replaces a list inside a screen, screen readers
 * announce it after what they are currently reading. Not "assertive": the failure is the result
 * of the user's own action (opening a tab, typing a search), so interrupting speech mid-sentence
 * would add nothing, and Android treats assertive announcements as interruptions.
 */
export function ErrorState({ title, message, onRetry }: ErrorStateProps): ReactElement {
  const { spacing } = useTheme();

  return (
    <View
      accessibilityLabel={title}
      accessibilityLiveRegion="polite"
      style={{ gap: spacing.small }}
    >
      <Heading>{title}</Heading>
      <BodyText>{message}</BodyText>
      {onRetry === undefined ? null : <Button label={RETRY_LABEL} onPress={onRetry} />}
    </View>
  );
}
