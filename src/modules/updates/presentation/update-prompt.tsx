import type { ReactElement } from 'react';
import { Modal } from 'react-native';

import { LoadingState, Screen } from '@shared/ui';

import { DownloadProgressView } from './download-progress';
import { InstallNote } from './install-note';
import { UpdateFailure } from './update-failure';
import { UpdateOffer } from './update-offer';
import {
  downloadAmountText,
  downloadPercent,
  downloadTitle,
  failureText,
  offerTitle,
} from './update-texts';
import { useUpdateFlow, type UpdateFlow } from './use-update-flow';

const OPENING_INSTALLER_LABEL = "Opening Android's installer";

/** The prompt content for each visible state; `null` while hidden (idle or dismissed). */
function promptContent(flow: UpdateFlow): ReactElement | null {
  const { state } = flow;
  switch (state.kind) {
    case 'idle':
    case 'dismissed':
      return null;
    case 'offered':
      return (
        <UpdateOffer
          title={offerTitle(state.release)}
          onUpdate={() => flow.update(state.release)}
          onLater={flow.dismiss}
        />
      );
    case 'downloading':
      return (
        <DownloadProgressView
          title={downloadTitle(state.release)}
          percent={downloadPercent(state.progress)}
          amountText={downloadAmountText(state.progress)}
          onCancel={flow.dismiss}
        />
      );
    case 'failed':
      return (
        <UpdateFailure
          {...failureText(state.error)}
          onRetry={() => flow.retry(state.release)}
          onClose={flow.dismiss}
        />
      );
    case 'installNote':
      return (
        <InstallNote onContinue={() => flow.openInstaller(state.apk)} onCancel={flow.dismiss} />
      );
    case 'installing':
      return <LoadingState label={OPENING_INSTALLER_LABEL} />;
  }
}

/**
 * Self-update prompt (S05-08 to S05-10), mounted once in the root layout inside
 * `AppBootstrapGate`, so it never appears over the startup failure screen and never delays
 * startup. Shown as a full-screen modal with the main action in thumb reach; Android's back
 * button acts like Later / Cancel / Close.
 */
export function UpdatePrompt(): ReactElement | null {
  const flow = useUpdateFlow();
  const content = promptContent(flow);
  if (content === null) {
    return null;
  }
  return (
    <Modal testID="update-prompt" visible animationType="slide" onRequestClose={flow.dismiss}>
      <Screen>{content}</Screen>
    </Modal>
  );
}
