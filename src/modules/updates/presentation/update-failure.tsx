import type { ReactElement } from 'react';

import { Button, ErrorState } from '@shared/ui';

import { PromptActions } from './prompt-actions';

export interface UpdateFailureProps {
  readonly title: string;
  readonly message: string;
  readonly onRetry: () => void;
  readonly onClose: () => void;
}

/** A failed download or installer hand-off, with Retry (download again) and Close (S05-09/10). */
export function UpdateFailure({
  title,
  message,
  onRetry,
  onClose,
}: UpdateFailureProps): ReactElement {
  return (
    <>
      <ErrorState title={title} message={message} />
      <PromptActions>
        <Button label="Retry" onPress={onRetry} />
        <Button label="Close" variant="secondary" onPress={onClose} />
      </PromptActions>
    </>
  );
}
