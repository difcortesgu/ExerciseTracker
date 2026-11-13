import type { ReactElement } from 'react';

import { EmptyState, Screen } from '@shared/ui';

/** Placeholder for the Workout tab (Sprint 0). */
export function WorkoutScreen(): ReactElement {
  return (
    <Screen title="Workout">
      <EmptyState message="Start a routine and follow the timer here. Coming soon." />
    </Screen>
  );
}
