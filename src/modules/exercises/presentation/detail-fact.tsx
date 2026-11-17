import type { ReactElement } from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@shared/ui';

export interface DetailFactProps {
  readonly label: string;
  readonly value: string;
}

/** One "Label: value" line of the detail screen, read as one phrase by screen readers. */
export function DetailFact({ label, value }: DetailFactProps): ReactElement {
  const { colors, typography } = useTheme();

  return (
    <View accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={{ color: colors.textMuted, fontSize: typography.captionSize }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: typography.bodySize }}>{value}</Text>
    </View>
  );
}
