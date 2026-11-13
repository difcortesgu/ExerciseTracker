import type { ReactElement } from 'react';
import { Text } from 'react-native';

import { useTheme } from './theme/use-theme';

export interface HeadingProps {
  readonly children: string;
}

/** Large, high-contrast title announced as a header by screen readers. */
export function Heading({ children }: HeadingProps): ReactElement {
  const { colors, typography } = useTheme();

  return (
    <Text
      accessibilityRole="header"
      style={{
        color: colors.text,
        fontSize: typography.headingSize,
        fontWeight: typography.strongWeight,
      }}
    >
      {children}
    </Text>
  );
}
