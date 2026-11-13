import { act, render, renderHook, screen } from '@testing-library/react-native';
import { Component, type ReactNode } from 'react';
import { Text } from 'react-native';

import type { Bootstrapper, StartupError } from '@core/bootstrap/bootstrapper';
import { domainError } from '@shared/domain/domain-error';
import { err, ok, type Result } from '@shared/domain/result';

import { useBootstrap } from './use-bootstrap';

type BootstrapResult = Result<void, StartupError>;

/** A bootstrapper whose outcome the test decides, and which counts its runs. */
function controllableBootstrapper() {
  let settle: (outcome: BootstrapResult) => void = () => undefined;
  let fail: (reason: Error) => void = () => undefined;
  let runs = 0;
  const bootstrap: Bootstrapper = () => {
    runs += 1;
    return new Promise<BootstrapResult>((resolve, reject) => {
      settle = resolve;
      fail = reject;
    });
  };
  return {
    bootstrap,
    runCount: () => runs,
    succeed: () => act(async () => settle(ok(undefined))),
    failWith: (error: StartupError) => act(async () => settle(err(error))),
    reject: (reason: Error) => act(async () => fail(reason)),
  };
}

const migrationFailed = domainError('db.migrationFailed', 'Migration 0002_sets failed.');

describe('useBootstrap', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports running while startup is in progress', async () => {
    const { bootstrap } = controllableBootstrapper();

    const { result } = await renderHook(() => useBootstrap(bootstrap));

    expect(result.current).toEqual({ status: 'running' });
  });

  it('reports ready when startup succeeds', async () => {
    const startup = controllableBootstrapper();
    const { result } = await renderHook(() => useBootstrap(startup.bootstrap));

    await startup.succeed();

    expect(result.current).toEqual({ status: 'ready' });
  });

  it('reports the failure when startup returns an error', async () => {
    const startup = controllableBootstrapper();
    const { result } = await renderHook(() => useBootstrap(startup.bootstrap));

    await startup.failWith(migrationFailed);

    expect(result.current).toEqual({ status: 'failed', error: migrationFailed });
  });

  it('types the failure as a StartupError, so the startup UI can map every code', async () => {
    const startup = controllableBootstrapper();
    const { result } = await renderHook(() => useBootstrap(startup.bootstrap));

    await startup.failWith(migrationFailed);

    const state = result.current;
    const code: StartupError['code'] | undefined =
      state.status === 'failed' ? state.error.code : undefined;
    expect(code).toBe('db.migrationFailed');
  });

  it('runs startup only once per mount, however often the component re-renders', async () => {
    const startup = controllableBootstrapper();
    const { rerender } = await renderHook(() => useBootstrap(startup.bootstrap));

    await rerender({});
    await startup.succeed();
    await rerender({});

    expect(startup.runCount()).toBe(1);
  });

  it('surfaces an unexpected rejection to the nearest error boundary instead of loading forever', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined); // React logs caught errors
    const startup = controllableBootstrapper();

    function BootstrapStatus() {
      return <Text>{useBootstrap(startup.bootstrap).status}</Text>;
    }
    await render(
      <TestErrorBoundary>
        <BootstrapStatus />
      </TestErrorBoundary>,
    );

    await startup.reject(new Error('database driver crashed'));

    expect(screen.getByText('Caught: database driver crashed')).toBeOnTheScreen();
  });
});

interface TestErrorBoundaryState {
  readonly error: Error | null;
}

class TestErrorBoundary extends Component<
  { readonly children: ReactNode },
  TestErrorBoundaryState
> {
  override state: TestErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override render() {
    return this.state.error === null ? (
      this.props.children
    ) : (
      <Text>{`Caught: ${this.state.error.message}`}</Text>
    );
  }
}
