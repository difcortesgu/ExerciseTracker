import type { ReactElement } from 'react';
import { Modal, View } from 'react-native';

import { BodyText } from './body-text';
import { Button, type ButtonVariant } from './button';
import { Heading } from './heading';
import { useTheme } from './theme/use-theme';

/** Dims the screen behind the dialog. */
const BACKDROP_COLOR = 'rgba(0, 0, 0, 0.6)';

export interface DialogAction {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
}

export interface DialogProps {
  readonly visible: boolean;
  readonly title: string;
  readonly message?: string;
  /** Full-width buttons, stacked in the thumb's reach; the first is the main action. */
  readonly actions: readonly DialogAction[];
  /** Android's back button or a tap outside: the same as cancelling. */
  readonly onDismiss: () => void;
}

/**
 * Themed modal dialog for confirmations ("Delete …?", "Discard changes?") and short choices
 * ("Camera" / "Gallery"). Used instead of the system alert so it follows the theme, uses the large
 * shared buttons and can be tested by role.
 */
export function Dialog({ visible, title, message, actions, onDismiss }: DialogProps): ReactElement {
  const { colors, spacing, shape } = useTheme();

  return (
    <Modal
      testID="dialog"
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          padding: spacing.medium,
          backgroundColor: BACKDROP_COLOR,
        }}
      >
        <View
          style={{
            gap: spacing.medium,
            padding: spacing.large,
            borderRadius: shape.cornerRadius,
            backgroundColor: colors.background,
          }}
        >
          <Heading>{title}</Heading>
          {message === undefined ? null : <BodyText>{message}</BodyText>}
          {actions.map((action) => (
            <Button
              key={action.label}
              label={action.label}
              variant={action.variant ?? 'primary'}
              onPress={action.onPress}
            />
          ))}
        </View>
      </View>
    </Modal>
  );
}
