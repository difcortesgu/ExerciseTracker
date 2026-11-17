import type { ReactElement } from 'react';
import { Text, TextInput, View } from 'react-native';

import { useTheme } from './theme/use-theme';

/** Visible lines of a multi-line field before it scrolls. */
const MULTILINE_MIN_LINES = 4;

export interface TextFieldProps {
  /** Shown above the input and used as its accessibility name. */
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  /** Shown below the field in the danger colour and read with the field by screen readers. */
  readonly error?: string;
  readonly multiline?: boolean;
  readonly placeholder?: string;
  /** Keep the accessibility name but do not show the label (e.g. a search field with a hint). */
  readonly hideLabel?: boolean;
}

/** Labelled, high-contrast text input with an optional error message (design system). */
export function TextField({
  label,
  value,
  onChangeText,
  error,
  multiline = false,
  placeholder,
  hideLabel = false,
}: TextFieldProps): ReactElement {
  const { colors, spacing, typography, interaction, shape } = useTheme();
  const hasError = error !== undefined;

  return (
    <View style={{ gap: spacing.small }}>
      {hideLabel ? null : (
        <Text
          style={{
            color: colors.text,
            fontSize: typography.bodySize,
            fontWeight: typography.strongWeight,
          }}
        >
          {label}
        </Text>
      )}
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        numberOfLines={multiline ? MULTILINE_MIN_LINES : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={{
          minHeight: interaction.minTouchTargetSize,
          paddingHorizontal: spacing.medium,
          paddingVertical: spacing.small,
          borderRadius: shape.cornerRadius,
          borderWidth: shape.borderWidth,
          borderColor: hasError ? colors.danger : colors.border,
          backgroundColor: colors.surface,
          color: colors.text,
          fontSize: typography.bodySize,
        }}
      />
      {hasError ? (
        <Text style={{ color: colors.danger, fontSize: typography.captionSize }}>{error}</Text>
      ) : null}
    </View>
  );
}
