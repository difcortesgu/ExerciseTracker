import type { ReactElement, ReactNode } from 'react';
import { Modal, ScrollView, View } from 'react-native';

import { Button, Chip, Screen, useTheme } from '@shared/ui';

import type { VocabularyKey } from '../domain/vocabulary';
import type { VocabularyOption } from '../application/exercise-dtos';

export const CUSTOM_VALUE_HINT = 'Custom';
const DONE_LABEL = 'Done';

export interface OptionPickerProps {
  readonly visible: boolean;
  /** E.g. "Muscle", "Primary muscles". */
  readonly title: string;
  readonly options: readonly VocabularyOption[];
  readonly selectedKeys: readonly VocabularyKey[];
  /** Tapping a value; whether it adds, removes or replaces is the caller's choice. */
  readonly onToggle: (option: VocabularyOption) => void;
  readonly onClose: () => void;
  /** Extra content below the values, e.g. "Add your own" in the form (S1-29). */
  readonly footer?: ReactNode;
}

/**
 * Full-screen list of vocabulary values for the library filters and the form pickers (S1-16,
 * S1-19, S1-29): built-in and user-defined values together, your own marked "Custom". Large chips
 * in thumb reach; Android's back button closes it like Done.
 */
export function OptionPicker({
  visible,
  title,
  options,
  selectedKeys,
  onToggle,
  onClose,
  footer,
}: OptionPickerProps): ReactElement {
  const { spacing } = useTheme();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen title={title}>
        <ScrollView contentContainerStyle={{ gap: spacing.medium }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.small }}>
            {options.map((option) => (
              <Chip
                key={option.key}
                label={option.label}
                {...(option.isCustom ? { hint: CUSTOM_VALUE_HINT } : {})}
                selected={selectedKeys.includes(option.key)}
                onPress={() => onToggle(option)}
              />
            ))}
          </View>
          {footer}
        </ScrollView>
        <Button label={DONE_LABEL} onPress={onClose} />
      </Screen>
    </Modal>
  );
}
