import type { ReactElement } from 'react';
import { Pressable, Text } from 'react-native';

import type { Theme } from './theme/tokens';
import { useTheme } from './theme/use-theme';

/**
 * `primary`: the one main action of a screen, filled. `secondary`: alternatives, outlined.
 * `destructive`: an action that removes data, filled with the danger colour.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'destructive';

export interface ButtonProps {
  /** Shown on the button and used as its accessibility name. */
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  /** Cannot be pressed, is announced as disabled and looks dimmed; keeps its size. */
  readonly disabled?: boolean;
}

interface VariantColors {
  readonly fill: string;
  readonly outline: string;
  readonly label: string;
}

/**
 * Strategy table: the colours of each variant. Text on a filled button uses the background colour,
 * which keeps AA contrast on both the accent and the danger colour in both themes.
 */
const VARIANT_COLORS: Readonly<Record<ButtonVariant, (colors: Theme['colors']) => VariantColors>> =
  {
    primary: (colors) => ({
      fill: colors.accent,
      outline: colors.accent,
      label: colors.background,
    }),
    secondary: (colors) => ({ fill: 'transparent', outline: colors.accent, label: colors.accent }),
    destructive: (colors) => ({
      fill: colors.danger,
      outline: colors.danger,
      label: colors.background,
    }),
  };

/** Large, high-contrast action button of the design system (S1-06). */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
}: ButtonProps): ReactElement {
  const { colors, spacing, typography, interaction, shape } = useTheme();
  const variantColors = VARIANT_COLORS[variant](colors);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: interaction.minTouchTargetSize,
        minWidth: interaction.minTouchTargetSize,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.medium,
        borderRadius: shape.cornerRadius,
        borderWidth: shape.borderWidth,
        borderColor: variantColors.outline,
        backgroundColor: variantColors.fill,
        opacity: disabled ? interaction.disabledOpacity : pressed ? interaction.pressedOpacity : 1,
      })}
    >
      <Text
        style={{
          color: variantColors.label,
          fontSize: typography.bodySize,
          fontWeight: typography.strongWeight,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
