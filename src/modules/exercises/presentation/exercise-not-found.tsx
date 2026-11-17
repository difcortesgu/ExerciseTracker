import type { ReactElement } from 'react';

import { Button, ErrorState, Screen } from '@shared/ui';

import { useBackToLibrary } from './use-back-to-library';

/** "Exercise not found" with a way back (S1-17): an unknown, deleted or malformed link. */
export function ExerciseNotFound(): ReactElement {
  const backToLibrary = useBackToLibrary();

  return (
    <Screen>
      <ErrorState
        title="Exercise not found"
        message="It may have been deleted, or the link is out of date."
      />
      <Button label="Back to exercises" onPress={backToLibrary} />
    </Screen>
  );
}
