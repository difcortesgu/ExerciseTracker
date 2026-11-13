import type { ErrorBoundaryProps } from 'expo-router';
import type { ReactElement } from 'react';

import { ErrorState, Screen } from '@shared/ui';

const UNEXPECTED_ERROR_TITLE = 'Something went wrong';
const UNEXPECTED_ERROR_MESSAGE =
  'Exercise Tracker hit an unexpected problem. Close and reopen Exercise Tracker to continue.';

/**
 * Root error boundary for expo-router (`export { AppErrorBoundary as ErrorBoundary }` in
 * `app/_layout.tsx`). Catches render-time programmer errors (e.g. a `useBootstrap` contract
 * rethrow or a missing DI registration) so the user sees a readable screen instead of a blank
 * or red one. Expected failures never reach it: they are `Result` errors shown by their screen.
 */
export function AppErrorBoundary(_props: ErrorBoundaryProps): ReactElement {
  return (
    <Screen>
      <ErrorState title={UNEXPECTED_ERROR_TITLE} message={UNEXPECTED_ERROR_MESSAGE} />
    </Screen>
  );
}
