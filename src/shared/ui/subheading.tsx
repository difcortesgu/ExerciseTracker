import type { ReactElement } from 'react';
import { Text } from 'react-native';

import { useTheme } from './theme/use-theme';

export interface SubheadingProps {
  readonly children: string;
}

/** Section title inside a screen, announced as a header (screen readers can jump between them). */
export function Subheading({ children }: SubheadingProps): ReactElement {
  const { colors, typography } = useTheme();

  return (
    <Text
      accessibilityRole="header"
      style={{
        color: colors.text,
        fontSize: typography.subheadingSize,
        fontWeight: typography.strongWeight,
      }}
    >
      {children}
    </Text>
  );
}
