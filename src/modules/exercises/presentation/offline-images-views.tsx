import type { ReactElement } from 'react';
import { View } from 'react-native';

import { BodyText, Button, ErrorState, LoadingState, ProgressBar, useTheme } from '@shared/ui';

import type { ExerciseLibraryError } from '../application/library-errors';
import type { OfflineImagesEstimate, OfflineImagesState } from '../application/offline-images';

import { exerciseErrorMessage } from './exercise-error-texts';
import { missingImagesText, progressLabel, progressText } from './offline-images-texts';
import type { LoadState } from './use-result-loader';

/** Presentational parts of the "Offline images" section (S1-28): plain props, no service. */

export const DOWNLOAD_ALL_LABEL = 'Download all images';
export const ALL_AVAILABLE_TEXT = 'All images are available offline';
/** ADR-004 T8: no background continuation in Expo Go, so the section says how to keep progress. */
export const KEEP_APP_OPEN_TEXT =
  'Keep the app open until the download finishes. Images downloaded so far are kept.';

export interface EstimateStatusProps {
  readonly estimate: LoadState<OfflineImagesEstimate, ExerciseLibraryError>;
  readonly onRetry: () => void;
  readonly onDownload: () => void;
}

/** What is still missing, with "Download all images", or that nothing is missing. */
export function EstimateStatus({
  estimate,
  onRetry,
  onDownload,
}: EstimateStatusProps): ReactElement {
  switch (estimate.status) {
    case 'loading':
      return <LoadingState label="Checking offline images" />;
    case 'failed':
      return (
        <ErrorState
          title="Couldn't check offline images"
          message={exerciseErrorMessage(estimate.error)}
          onRetry={onRetry}
        />
      );
    case 'loaded':
      return estimate.value.missingCount === 0 ? (
        <BodyText>{ALL_AVAILABLE_TEXT}</BodyText>
      ) : (
        <>
          <BodyText>{missingImagesText(estimate.value)}</BodyText>
          <Button label={DOWNLOAD_ALL_LABEL} onPress={onDownload} />
        </>
      );
  }
}

export function PreparingDownload(): ReactElement {
  return (
    <>
      <LoadingState label="Preparing the download" />
      <BodyText tone="textMuted">{KEEP_APP_OPEN_TEXT}</BodyText>
    </>
  );
}

export interface RunProgressProps {
  readonly state: Extract<OfflineImagesState, { status: 'running' }>;
  readonly onCancel: () => void;
}

/** "n of total" with an announced progress bar, the keep-open note and "Cancel download". */
export function RunProgress({ state, onCancel }: RunProgressProps): ReactElement {
  const { spacing } = useTheme();

  return (
    <View style={{ gap: spacing.small }}>
      <ProgressBar
        label={progressLabel(state)}
        value={state.completed + state.failed}
        max={state.total}
      />
      <BodyText>{progressText(state)}</BodyText>
      <BodyText tone="textMuted">{KEEP_APP_OPEN_TEXT}</BodyText>
      <Button label="Cancel download" variant="secondary" onPress={onCancel} />
    </View>
  );
}

export interface RunSummaryProps {
  readonly text: string;
  /** When given, "Retry failed" starts a run for the images that are still missing. */
  readonly onRetryFailed?: () => void;
}

/** Outcome of the last run, announced politely when it replaces the progress. */
export function RunSummary({ text, onRetryFailed }: RunSummaryProps): ReactElement {
  const { spacing } = useTheme();

  return (
    <View accessibilityLiveRegion="polite" style={{ gap: spacing.small }}>
      <BodyText>{text}</BodyText>
      {onRetryFailed === undefined ? null : <Button label="Retry failed" onPress={onRetryFailed} />}
    </View>
  );
}
