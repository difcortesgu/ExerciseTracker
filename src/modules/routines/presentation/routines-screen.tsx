import type { ReactElement } from 'react';

import { EmptyState, Screen } from '@shared/ui';

/** Placeholder for the Routines tab (Sprint 0). */
export function RoutinesScreen(): ReactElement {
  return (
    <Screen title="Routines">
      <EmptyState message="Build routines from nested blocks of exercises and rests. Coming soon." />
    </Screen>
  );
}
