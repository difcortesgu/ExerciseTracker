import type { ReactElement } from 'react';

import { EmptyState, Screen } from '@shared/ui';

/** Placeholder for the Settings tab (Sprint 0). */
export function SettingsScreen(): ReactElement {
  return (
    <Screen title="Settings">
      <EmptyState message="Choose units, sounds and theme. Coming soon." />
    </Screen>
  );
}
