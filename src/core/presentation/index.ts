/** Public API of the app-wide presentation layer (navigation shell, DI binding, startup UI). */
export { AppBootstrapGate, type AppBootstrapGateProps } from './app-bootstrap-gate';
export { AppErrorBoundary } from './app-error-boundary';
export { AppShell, type AppShellProps } from './app-shell';
export { AppTabs } from './app-tabs';
export {
  DependencyProvider,
  type DependencyProviderProps,
  useDependency,
} from './dependency-provider';
export { type BootstrapState, useBootstrap } from './use-bootstrap';
