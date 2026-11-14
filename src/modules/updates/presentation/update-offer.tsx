import type { ReactElement } from 'react';

import { Heading } from '@shared/ui';

import { PromptActions } from './prompt-actions';
import { PromptButton } from './prompt-button';

export interface UpdateOfferProps {
  /** E.g. "Build 42 available (35 MB)". */
  readonly title: string;
  readonly onUpdate: () => void;
  readonly onLater: () => void;
}

/** "Build N available – Update / Later" (S05-08). Nothing is downloaded before Update. */
export function UpdateOffer({ title, onUpdate, onLater }: UpdateOfferProps): ReactElement {
  return (
    <>
      <Heading>{title}</Heading>
      <PromptActions>
        <PromptButton label="Update" onPress={onUpdate} />
        <PromptButton label="Later" variant="secondary" onPress={onLater} />
      </PromptActions>
    </>
  );
}
