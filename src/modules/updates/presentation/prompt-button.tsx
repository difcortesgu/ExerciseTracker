import type { ReactElement } from 'react';
import { Pressable, Text } from 'react-native';

import { useTheme } from '@shared/ui';

/**
 * Minimum height of a tappable action, so it can be hit with a thumb mid-workout (above
 * Android's 48 dp guideline).
 */
export const MIN_TOUCH_TARGET_SIZE = 56;

/** Visible feedback that a tap registered (no colour change needed, works in both themes). */
export const PRESSED_OPACITY = 0.7;
const BORDER_WIDTH = 2;
const CORNER_RADIUS = 12;

/** `primary`: the one main action, filled. `secondary`: alternatives, outlined. */
export type PromptButtonVariant = 'primary' | 'secondary';

export interface PromptButtonProps {
  /** Shown on the button and used as its accessibility name. */
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: PromptButtonVariant;
}

/**
 * Large, high-contrast action button of the update prompt. Text on the filled accent uses the
 * background colour, which keeps AA contrast in both themes.
 *
 * Local to `updates` because it is the only module with actions so far; promote it to
 * `shared/ui` when a second module needs buttons (rule of three, ENGINEERING_STANDARDS §2).
 */
export function PromptButton({
  label,
  onPress,
  variant = 'primary',
}: PromptButtonProps): ReactElement {
  const { colors, spacing, typography } = useTheme();
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: MIN_TOUCH_TARGET_SIZE,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.medium,
        borderRadius: CORNER_RADIUS,
        borderWidth: BORDER_WIDTH,
        borderColor: colors.accent,
        backgroundColor: isPrimary ? colors.accent : 'transparent',
        opacity: pressed ? PRESSED_OPACITY : 1,
      })}
    >
      <Text
        style={{
          color: isPrimary ? colors.background : colors.accent,
          fontSize: typography.bodySize,
          fontWeight: typography.strongWeight,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
