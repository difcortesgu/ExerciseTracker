import { act, renderHook } from '@testing-library/react-native';
import { useCallback } from 'react';

import { domainError, type DomainError } from '@shared/domain/domain-error';
import { err, ok, type Result } from '@shared/domain/result';

import { useResultLoader } from './use-result-loader';

type Outcome = Result<string, DomainError>;

/** A loader whose calls the test settles one by one, in any order. */
function controllableLoader() {
  const pending: ((outcome: Outcome) => void)[] = [];
  const load = jest.fn(
    () =>
      new Promise<Outcome>((resolve) => {
        pending.push(resolve);
      }),
  );
  const settle = (index: number, outcome: Outcome) =>
    act(async () => {
      pending[index]?.(outcome);
    });
  return { load, settle, calls: () => load.mock.calls.length };
}

const failure = domainError('exercises.storageFailed', 'locked');

describe('useResultLoader', () => {
  it('is loading until the first result arrives', async () => {
    const loader = controllableLoader();

    const { result } = await renderHook(() => useResultLoader(loader.load));

    expect(result.current.state).toEqual({ status: 'loading' });
    expect(loader.calls()).toBe(1);
  });

  it('shows the loaded value', async () => {
    const loader = controllableLoader();
    const { result } = await renderHook(() => useResultLoader(loader.load));

    await loader.settle(0, ok('squat'));

    expect(result.current.state).toEqual({ status: 'loaded', value: 'squat' });
  });

  it('shows the error of a failed load', async () => {
    const loader = controllableLoader();
    const { result } = await renderHook(() => useResultLoader(loader.load));

    await loader.settle(0, err(failure));

    expect(result.current.state).toEqual({ status: 'failed', error: failure });
  });

  it('shows loading again when retrying after a failure', async () => {
    const loader = controllableLoader();
    const { result } = await renderHook(() => useResultLoader(loader.load));
    await loader.settle(0, err(failure));

    await act(async () => result.current.reload());

    expect(result.current.state).toEqual({ status: 'loading' });
    await loader.settle(1, ok('squat'));
    expect(result.current.state).toEqual({ status: 'loaded', value: 'squat' });
  });

  it('keeps showing the loaded value while refreshing, so a list keeps its place', async () => {
    const loader = controllableLoader();
    const { result } = await renderHook(() => useResultLoader(loader.load));
    await loader.settle(0, ok('squat'));

    await act(async () => result.current.reload());

    expect(result.current.state).toEqual({ status: 'loaded', value: 'squat' });
    await loader.settle(1, ok('squat, press'));
    expect(result.current.state).toEqual({ status: 'loaded', value: 'squat, press' });
  });

  it('loads again when the loader changes (e.g. a new search)', async () => {
    const queries: string[] = [];
    const { result, rerender } = await renderHook(
      ({ query }: { query: string }) =>
        useResultLoader(
          useCallback(() => {
            queries.push(query);
            return Promise.resolve(ok(`results for ${query}`));
          }, [query]),
        ),
      { initialProps: { query: 'squ' } },
    );

    await rerender({ query: 'squat' });

    expect(queries).toEqual(['squ', 'squat']);
    expect(result.current.state).toEqual({ status: 'loaded', value: 'results for squat' });
  });

  it('ignores a slower, older answer that arrives after a newer one', async () => {
    const loader = controllableLoader();
    const { result } = await renderHook(() => useResultLoader(loader.load));
    await act(async () => result.current.reload());

    await loader.settle(1, ok('new'));
    await loader.settle(0, ok('old'));

    expect(result.current.state).toEqual({ status: 'loaded', value: 'new' });
  });

  it('ignores an answer that arrives after unmounting', async () => {
    const loader = controllableLoader();
    const { result, unmount } = await renderHook(() => useResultLoader(loader.load));

    await unmount();
    await loader.settle(0, ok('late'));

    expect(result.current.state).toEqual({ status: 'loading' });
  });

  it('surfaces a rejected load (a broken use-case contract) to the error boundary', async () => {
    const silenceReactErrorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const rejecting = () => Promise.reject(new Error('driver crashed'));

    await expect(renderHook(() => useResultLoader(rejecting))).rejects.toThrow('driver crashed');

    silenceReactErrorLog.mockRestore();
  });
});
