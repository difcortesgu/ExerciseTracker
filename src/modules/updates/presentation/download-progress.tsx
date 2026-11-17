import type { ReactElement } from 'react';
import { View } from 'react-native';

import { BodyText, Button, Heading, ProgressBar, useTheme } from '@shared/ui';

import { PromptActions } from './prompt-actions';

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
  const { spacing } = useTheme();

  return (
    <>
      <Heading>{title}</Heading>
      <ProgressBar
        label={`Download progress ${percent}%`}
        value={percent}
        max={PERCENT_MAX}
        fillTestID="download-progress-fill"
      />
      <View style={{ gap: spacing.small }}>
        <BodyText>{`${percent}%`}</BodyText>
        <BodyText tone="textMuted">{amountText}</BodyText>
      </View>
      <PromptActions>
        <Button label="Cancel download" variant="secondary" onPress={onCancel} />
      </PromptActions>
    </>
  );
}
