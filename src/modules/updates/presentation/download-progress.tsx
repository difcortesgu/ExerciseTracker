import type { ReactElement } from 'react';
import { View } from 'react-native';

import { BodyText, Heading, useTheme } from '@shared/ui';

import { PromptActions } from './prompt-actions';
import { PromptButton } from './prompt-button';

const PROGRESS_BAR_HEIGHT = 16;
const PERCENT_MAX = 100;

export interface DownloadProgressViewProps {
  /** E.g. "Downloading build 42". */
  readonly title: string;
  /** Whole number from 0 to 100. */
  readonly percent: number;
  /** E.g. "15.8 MB of 35 MB". */
  readonly amountText: string;
  readonly onCancel: () => void;
}

/** Download progress with a cancel action (S05-09); the bar is announced to screen readers. */
export function DownloadProgressView({
  title,
  percent,
  amountText,
  onCancel,
}: DownloadProgressViewProps): ReactElement {
  const { colors, spacing } = useTheme();

  return (
    <>
      <Heading>{title}</Heading>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Download progress ${percent}%`}
        accessibilityValue={{ min: 0, max: PERCENT_MAX, now: percent }}
        style={{
          height: PROGRESS_BAR_HEIGHT,
          borderRadius: PROGRESS_BAR_HEIGHT / 2,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          overflow: 'hidden',
        }}
      >
        <View
          testID="download-progress-fill"
          style={{ width: `${percent}%`, height: '100%', backgroundColor: colors.accent }}
        />
      </View>
      <View style={{ gap: spacing.small }}>
        <BodyText>{`${percent}%`}</BodyText>
        <BodyText tone="textMuted">{amountText}</BodyText>
      </View>
      <PromptActions>
        <PromptButton label="Cancel download" variant="secondary" onPress={onCancel} />
      </PromptActions>
    </>
  );
}
