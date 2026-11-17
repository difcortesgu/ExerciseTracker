import type { ReactElement } from 'react';
import { View } from 'react-native';

import { BodyText, Dialog, Subheading, useTheme } from '@shared/ui';

import {
  cancelledSummaryText,
  confirmationMessage,
  finishedSummaryText,
} from './offline-images-texts';
import {
  DOWNLOAD_ALL_LABEL,
  EstimateStatus,
  PreparingDownload,
  RunProgress,
  RunSummary,
} from './offline-images-views';
import { useOfflineImages, type OfflineImagesViewModel } from './use-offline-images';

const SECTION_TITLE = 'Offline images';
const DESCRIPTION =
  'Download every built-in exercise image once, so the library shows images without a connection.';

/**
 * Settings → "Offline images" (S1-28, ADR-004 T8): the user-triggered bulk download of the
 * built-in images, exported by `exercises` and rendered by Settings. Renders the view model only.
 */
export function OfflineImagesSection(): ReactElement {
  const viewModel = useOfflineImages();
  const { spacing } = useTheme();
  const { estimate } = viewModel;

  return (
    <View style={{ gap: spacing.medium }}>
      <Subheading>{SECTION_TITLE}</Subheading>
      <BodyText tone="textMuted">{DESCRIPTION}</BodyText>
      <OfflineImagesBody viewModel={viewModel} />
      {estimate.status === 'loaded' ? (
        <Dialog
          visible={viewModel.isConfirming}
          title={`${DOWNLOAD_ALL_LABEL}?`}
          message={confirmationMessage(estimate.value)}
          actions={[
            { label: 'Download', onPress: viewModel.confirmDownload },
            { label: 'Cancel', variant: 'secondary', onPress: viewModel.dismissConfirmation },
          ]}
          onDismiss={viewModel.dismissConfirmation}
        />
      ) : null}
    </View>
  );
}

/** One view per run state; the estimate is offered whenever a new run makes sense. */
function OfflineImagesBody({
  viewModel,
}: {
  readonly viewModel: OfflineImagesViewModel;
}): ReactElement {
  const { run } = viewModel;
  const estimateStatus = (
    <EstimateStatus
      estimate={viewModel.estimate}
      onRetry={viewModel.reloadEstimate}
      onDownload={viewModel.requestDownload}
    />
  );

  switch (run.status) {
    case 'idle':
      return estimateStatus;
    case 'preparing':
      return <PreparingDownload />;
    case 'running':
      return <RunProgress state={run} onCancel={viewModel.cancelDownload} />;
    case 'finished':
      return run.failed > 0 ? (
        <RunSummary text={finishedSummaryText(run)} onRetryFailed={viewModel.retryFailed} />
      ) : (
        <>
          <RunSummary text={finishedSummaryText(run)} />
          {estimateStatus}
        </>
      );
    case 'cancelled':
      return (
        <>
          <RunSummary text={cancelledSummaryText(run)} />
          {estimateStatus}
        </>
      );
  }
}
