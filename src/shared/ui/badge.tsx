import type { ReactElement } from 'react';
import { Text, View } from 'react-native';

import { useTheme } from './theme/use-theme';

const BADGE_PADDING_VERTICAL = 2;

export interface BadgeProps {
  /** One short word, e.g. "Custom". */
  readonly label: string;
}

/** Small outlined tag that marks an item (e.g. a custom exercise in the library list). */
export function Badge({ label }: BadgeProps): ReactElement {
  const { colors, spacing, typography, shape } = useTheme();

  return (
    <View
      testID="badge"
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.small,
        paddingVertical: BADGE_PADDING_VERTICAL,
        borderRadius: shape.cornerRadius,
        borderWidth: 1,
        borderColor: colors.accent,
      }}
    >
      <Text
        style={{
          color: colors.accent,
          fontSize: typography.captionSize,
          fontWeight: typography.strongWeight,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
