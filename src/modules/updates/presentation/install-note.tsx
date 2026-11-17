import type { ReactElement } from 'react';
import { View } from 'react-native';

import { BodyText, Button, Heading, useTheme } from '@shared/ui';

import { PromptActions } from './prompt-actions';

const INSTALL_NOTE_TITLE = 'Install the update';
const INSTALL_NOTE_MESSAGE =
  'Android opens its installer next. The first time, it asks you to allow "Install unknown apps" ' +
  'for Exercise Tracker: allow it, then confirm the install. Your workouts are kept.';

export interface InstallNoteProps {
  readonly onContinue: () => void;
  readonly onCancel: () => void;
}

/**
 * Explains the Android permission step before the installer hand-off (S05-10). Shown every time,
 * because Expo offers no API to ask whether the permission was already granted.
 */
export function InstallNote({ onContinue, onCancel }: InstallNoteProps): ReactElement {
  const { spacing } = useTheme();

  return (
    <>
      <View accessibilityLabel={INSTALL_NOTE_TITLE} style={{ gap: spacing.small }}>
        <Heading>{INSTALL_NOTE_TITLE}</Heading>
        <BodyText>{INSTALL_NOTE_MESSAGE}</BodyText>
      </View>
      <PromptActions>
        <Button label="Open installer" onPress={onContinue} />
        <Button label="Not now" variant="secondary" onPress={onCancel} />
      </PromptActions>
    </>
  );
}
