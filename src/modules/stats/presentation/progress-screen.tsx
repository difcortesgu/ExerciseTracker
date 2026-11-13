import type { ReactElement } from 'react';

import { EmptyState, Screen } from '@shared/ui';

/** Placeholder for the Progress tab (Sprint 0). */
export function ProgressScreen(): ReactElement {
  return (
    <Screen title="Progress">
      <EmptyState message="Track personal records and progress charts. Coming soon." />
    </Screen>
  );
}
