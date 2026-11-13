import type { ReactElement, ReactNode } from 'react';

import { BootstrapperToken } from '@core/bootstrap/bootstrapper';
import { ErrorState, LoadingState, Screen } from '@shared/ui';

import { useDependency } from './dependency-provider';
import { useBootstrap } from './use-bootstrap';

const STARTUP_LOADING_LABEL = 'Loading Exercise Tracker';
const STARTUP_FAILED_TITLE = 'Startup failed';

export interface AppBootstrapGateProps {
  /** The app (tabs); rendered only after startup succeeded. */
  readonly children: ReactNode;
}

/**
 * Startup UI (S0-17): runs the bootstrapper from the DI container and shows a loading state, a
 * readable error screen, or the app. The app never renders half-initialised.
 */
export function AppBootstrapGate({ children }: AppBootstrapGateProps): ReactElement {
  const state = useBootstrap(useDependency(BootstrapperToken));

  switch (state.status) {
    case 'running':
      return (
        <Screen>
          <LoadingState label={STARTUP_LOADING_LABEL} />
        </Screen>
      );
    case 'failed':
      return (
        <Screen>
          <ErrorState title={STARTUP_FAILED_TITLE} message={state.error.message} />
        </Screen>
      );
    case 'ready':
      return <>{children}</>;
  }
}
