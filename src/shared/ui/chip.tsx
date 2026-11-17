import type { ReactElement } from 'react';
import { Pressable, Text } from 'react-native';

import { useTheme } from './theme/use-theme';

const CHIP_RADIUS = 28;

export interface ChipProps {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  /** Short extra word shown after the label and read with it (e.g. "Custom" for your own value). */
  readonly hint?: string;
}

/**
 * Toggleable pill for multi-choice options (filters, tracked metrics, picker values). Announced as
 * a checkbox with its checked state; selected chips are filled, so the state is visible at a glance
 * and not by colour alone.
 */
export function Chip({ label, selected, onPress, hint }: ChipProps): ReactElement {
  const { colors, spacing, typography, interaction, shape } = useTheme();
  const textColor = selected ? colors.background : colors.text;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={hint === undefined ? label : `${label}, ${hint}`}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: interaction.minTouchTargetSize,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.small,
        paddingHorizontal: spacing.medium,
        borderRadius: CHIP_RADIUS,
        borderWidth: shape.borderWidth,
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: selected ? colors.accent : 'transparent',
        opacity: pressed ? interaction.pressedOpacity : 1,
      })}
    >
      <Text style={{ color: textColor, fontSize: typography.bodySize }}>{label}</Text>
      {hint === undefined ? null : (
        <Text style={{ color: textColor, fontSize: typography.captionSize }}>{hint}</Text>
      )}
    </Pressable>
  );
}
