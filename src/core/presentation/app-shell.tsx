import type { ReactElement, ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';

import type { Resolver } from '@core/di/container';

import { AppBootstrapGate } from './app-bootstrap-gate';
import { DependencyProvider } from './dependency-provider';

export interface AppShellProps {
  /** The composition-root container (tests pass one registered with fakes). */
  readonly resolver: Resolver;
  /** The routes (expo-router's `<Slot />`). */
  readonly children: ReactNode;
  /**
   * Rendered next to the routes, and like them **only after a successful startup**: never over the
   * startup failure screen and never delaying startup (e.g. the update prompt, S05-08 / Q6).
   */
  readonly overlay?: ReactNode;
}

/**
 * Root layout composition (QA-05-3): DI binding, status bar and startup gate in one tested place,
 * so `app/_layout.tsx` only passes the routes and the feature overlays. Feature modules are passed
 * in as `overlay`, which keeps `src/core/presentation` independent of them (ADR-003 §6).
 */
export function AppShell({ resolver, children, overlay }: AppShellProps): ReactElement {
  return (
    <DependencyProvider resolver={resolver}>
      <StatusBar style="auto" />
      <AppBootstrapGate>
        {children}
        {overlay}
      </AppBootstrapGate>
    </DependencyProvider>
  );
}
