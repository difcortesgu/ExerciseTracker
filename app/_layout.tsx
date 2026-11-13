import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { createProductionContainer } from '@core/di/composition-root';
import { AppBootstrapGate, DependencyProvider } from '@core/presentation';

/** Root error boundary: a readable screen for render-time programmer errors. */
export { AppErrorBoundary as ErrorBoundary } from '@core/presentation';

/** Created once per app process: the single composition root (ADR-001 §4). */
const container = createProductionContainer();

export default function RootLayout() {
  return (
    <DependencyProvider resolver={container}>
      <StatusBar style="auto" />
      <AppBootstrapGate>
        <Slot />
      </AppBootstrapGate>
    </DependencyProvider>
  );
}
