import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from 'react';

import type { Resolver } from '@core/di/container';
import type { Token } from '@shared/application/di/token';

/**
 * React binding of the DI container (S0-16). Screens and view-model hooks obtain use cases with
 * `useDependency(token)` and never construct dependencies themselves. Production code passes the
 * composition-root container; tests pass a container registered with fakes.
 */
const ResolverContext = createContext<Resolver | null>(null);

export interface DependencyProviderProps {
  readonly resolver: Resolver;
  readonly children: ReactNode;
}

export function DependencyProvider({ resolver, children }: DependencyProviderProps): ReactElement {
  return <ResolverContext value={resolver}>{children}</ResolverContext>;
}

/**
 * Resolves `token` from the nearest `DependencyProvider`. The instance is resolved once per
 * mounted component, so a dependency stays stable across re-renders (even with a transient
 * lifetime). Throws a programmer error when no provider is mounted above the caller.
 */
export function useDependency<T>(token: Token<T>): T {
  const resolver = useContext(ResolverContext);
  if (resolver === null) {
    throw new Error(
      `useDependency("${token.description}") was called outside a DependencyProvider. ` +
        'Wrap the component tree in <DependencyProvider resolver={container}>.',
    );
  }
  return useMemo(() => resolver.resolve(token), [resolver, token]);
}
