import type { ReactElement, ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Heading } from './heading';
import { useTheme } from './theme/use-theme';

export interface ScreenProps {
  /**
   * Shown as the screen heading; also names the screen for accessibility (`"<title> screen"`).
   * Omit it for screens whose content labels itself (e.g. startup loading and error states).
   */
  readonly title?: string;
  readonly children?: ReactNode;
}

/** Root container of every screen: theme background, safe-area padding and an optional heading. */
export function Screen({ title, children }: ScreenProps): ReactElement {
  const { colors, spacing } = useTheme();

  return (
    <SafeAreaView
      accessibilityLabel={title === undefined ? undefined : `${title} screen`}
      style={{
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.medium,
        gap: spacing.medium,
      }}
    >
      {title === undefined ? null : <Heading>{title}</Heading>}
      {children}
    </SafeAreaView>
  );
}
