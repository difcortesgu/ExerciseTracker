import { useEffect, useState } from 'react';

import type { Bootstrapper, StartupError } from '@core/bootstrap/bootstrapper';

/** What the startup UI shows: a loading state, the app, or a readable error screen. */
export type BootstrapState =
  | { readonly status: 'running' }
  | { readonly status: 'ready' }
  | { readonly status: 'failed'; readonly error: StartupError };

const RUNNING: BootstrapState = Object.freeze({ status: 'running' });
const READY: BootstrapState = Object.freeze({ status: 'ready' });

/**
 * View-model hook (MVVM) for app startup (S0-17): runs the bootstrapper once per mount and
 * exposes its progress. Expected failures arrive as `err` and become the `failed` state. A
 * rejection breaks the bootstrapper contract (a programmer error), so it is rethrown during
 * render for the nearest error boundary instead of leaving the user on an endless spinner.
 */
export function useBootstrap(bootstrap: Bootstrapper): BootstrapState {
  const [state, setState] = useState<BootstrapState>(RUNNING);

  useEffect(() => {
    bootstrap().then(
      (result) => setState(result.ok ? READY : { status: 'failed', error: result.error }),
      (reason: unknown) =>
        setState(() => {
          throw reason;
        }),
    );
  }, [bootstrap]);

  return state;
}
