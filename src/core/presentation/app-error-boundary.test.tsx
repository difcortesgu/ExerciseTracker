import { Slot } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { AppErrorBoundary } from './app-error-boundary';

const ERROR_TITLE = 'Something went wrong';

function ThrowingRoute(): never {
  throw new Error('No provider registered for token "Bootstrapper"');
}

function HealthyRoute() {
  return <Text>Workout content</Text>;
}

async function renderRootWith(route: () => React.ReactElement | null): Promise<void> {
  await renderRouter(
    {
      _layout: { default: () => <Slot />, ErrorBoundary: AppErrorBoundary },
      index: route,
    },
    { initialUrl: '/' },
  );
}

describe('AppErrorBoundary', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows a readable error screen instead of a blank screen when a route throws while rendering', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined); // React logs caught errors

    await renderRootWith(ThrowingRoute);

    expect(screen.getByLabelText(ERROR_TITLE)).toHaveTextContent(
      /Close and reopen Exercise Tracker/,
    );
  });

  it('does not show the error screen when nothing fails', async () => {
    await renderRootWith(HealthyRoute);

    expect(screen.getByText('Workout content')).toBeOnTheScreen();
    expect(screen.queryByLabelText(ERROR_TITLE)).not.toBeOnTheScreen();
  });
});
