import { useState, type ReactElement } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@shared/ui';

import type { VocabularyKey } from '../domain/vocabulary';
import type { VocabularyOption } from '../application/exercise-dtos';

import { AddOwnValue } from './add-own-value';
import { OptionPicker } from './option-picker';

const NOTHING_CHOSEN = 'None';

export interface PickerFieldProps {
  /** Field name, also its accessibility name (e.g. "Primary muscles"). */
  readonly label: string;
  /** For "Add your own": the input is labelled "New <noun>". */
  readonly noun: string;
  readonly options: readonly VocabularyOption[];
  readonly chosen: readonly VocabularyOption[];
  readonly onToggle: (option: VocabularyOption) => void;
  readonly onAddOwn: (label: string) => Promise<string | undefined>;
  readonly error?: string | undefined;
}

/** A form field that opens the value picker with "Add your own" (S1-19, S1-29). */
export function PickerField({
  label,
  noun,
  options,
  chosen,
  onToggle,
  onAddOwn,
  error,
}: PickerFieldProps): ReactElement {
  const { colors, spacing, typography, interaction, shape } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const chosenText =
    chosen.length === 0 ? NOTHING_CHOSEN : chosen.map((option) => option.label).join(', ');
  const chosenKeys: readonly VocabularyKey[] = chosen.map((option) => option.key);

  return (
    <View style={{ gap: spacing.small }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: chosenText }}
        {...(error === undefined ? {} : { accessibilityHint: error })}
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => ({
          minHeight: interaction.minTouchTargetSize,
          justifyContent: 'center',
          paddingHorizontal: spacing.medium,
          paddingVertical: spacing.small,
          borderRadius: shape.cornerRadius,
          borderWidth: shape.borderWidth,
          borderColor: error === undefined ? colors.border : colors.danger,
          backgroundColor: colors.surface,
          opacity: pressed ? interaction.pressedOpacity : 1,
        })}
      >
        <Text style={{ color: colors.textMuted, fontSize: typography.captionSize }}>{label}</Text>
        <Text style={{ color: colors.text, fontSize: typography.bodySize }}>{chosenText}</Text>
      </Pressable>
      {error === undefined ? null : (
        <Text style={{ color: colors.danger, fontSize: typography.captionSize }}>{error}</Text>
      )}
      {isOpen ? (
        <OptionPicker
          visible
          title={label}
          options={options}
          selectedKeys={chosenKeys}
          onToggle={onToggle}
          onClose={() => setIsOpen(false)}
          footer={<AddOwnValue noun={noun} onAdd={onAddOwn} />}
        />
      ) : null}
    </View>
  );
}
