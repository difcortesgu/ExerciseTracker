import type { ReactElement } from 'react';

import { EmptyState, Screen } from '@shared/ui';

/** Placeholder for the Exercises tab (Sprint 0). */
export function ExercisesScreen(): ReactElement {
  return (
    <Screen title="Exercises">
      <EmptyState message="Browse the exercise library and add your own exercises. Coming soon." />
    </Screen>
  );
}
