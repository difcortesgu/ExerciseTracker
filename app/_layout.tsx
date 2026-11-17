import { createProductionContainer } from '@core/di/composition-root';
import { AppShell, AppStack } from '@core/presentation';
import { UpdatePrompt } from '@modules/updates';

/** Root error boundary: a readable screen for render-time programmer errors. */
export { AppErrorBoundary as ErrorBoundary } from '@core/presentation';

/** Created once per app process: the single composition root (ADR-001 §4). */
const container = createProductionContainer();

/**
 * Thin route: the composition (DI, startup gate) is `AppShell` and the root navigator is
 * `AppStack` (tabs first, detail and form screens on top), both tested in src/core/presentation.
 * The update prompt is its `overlay`: shown only after a successful startup (S05-08, Q6).
 */
export default function RootLayout() {
  return (
    <AppShell resolver={container} overlay={<UpdatePrompt />}>
      <AppStack />
    </AppShell>
  );
}
