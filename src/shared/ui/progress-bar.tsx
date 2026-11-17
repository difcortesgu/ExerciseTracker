import type { ReactElement } from 'react';
import { View } from 'react-native';

import { useTheme } from './theme/use-theme';

const BAR_HEIGHT = 16;
const PERCENT_MAX = 100;

export interface ProgressBarProps {
  /** Announced by screen readers, e.g. "Image download progress, 250 of 1 746". */
  readonly label: string;
  readonly value: number;
  readonly max: number;
  /** Lets a test find the filled part. */
  readonly fillTestID?: string;
}

/** Share of `value` in `max` as a whole-number percentage, clamped to 0..100 (0 when `max` ≤ 0). */
function filledPercent(value: number, max: number): number {
  if (max <= 0) {
    return 0;
  }
  return Math.min(PERCENT_MAX, Math.max(0, (value / max) * PERCENT_MAX));
}

/** Horizontal progress bar announced to screen readers with its label and value. */
export function ProgressBar({ label, value, max, fillTestID }: ProgressBarProps): ReactElement {
  const { colors } = useTheme();

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: value }}
      style={{
        height: BAR_HEIGHT,
        borderRadius: BAR_HEIGHT / 2,
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        overflow: 'hidden',
      }}
    >
      <View
        testID={fillTestID}
        style={{
          width: `${filledPercent(value, max)}%`,
          height: '100%',
          backgroundColor: colors.accent,
        }}
      />
    </View>
  );
}
