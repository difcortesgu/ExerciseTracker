import type { ReactElement } from 'react';

import { Button, Heading } from '@shared/ui';

import { PromptActions } from './prompt-actions';

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
        <Button label="Update" onPress={onUpdate} />
        <Button label="Later" variant="secondary" onPress={onLater} />
      </PromptActions>
    </>
  );
}
