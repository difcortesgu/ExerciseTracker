import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Result } from '@shared/domain/result';

/** What a screen shows for data it loads through a use case. */
export type LoadState<T, E> =
  | { readonly status: 'loading' }
  | { readonly status: 'failed'; readonly error: E }
  | { readonly status: 'loaded'; readonly value: T };

export interface ResultLoader<T, E> {
  readonly state: LoadState<T, E>;
  /** Loads again (Retry, or a refresh when the screen is shown again). */
  readonly reload: () => void;
}

const LOADING = Object.freeze({ status: 'loading' as const });

/** One call of `load`: a new object per (loader, reload) pair, so answers can be matched to it. */
interface Request<T, E> {
  readonly load: () => Promise<Result<T, E>>;
  readonly reloadCount: number;
}

/** The answer to one request (never `loading`). */
interface Settled<T, E> {
  readonly request: Request<T, E>;
  readonly state: LoadState<T, E>;
}

/**
 * View-model building block (MVVM) for screens that show the `Result` of one use-case call.
 *
 * - Runs `load` on mount, whenever `load` changes (memoize it with `useCallback`, keyed by its
 *   inputs, e.g. the search query) and on `reload()`.
 * - While refreshing, the value already shown stays on screen (no spinner flash, a list keeps its
 *   scroll position); after a failure, a reload shows the loading state again.
 * - Only the answer to the latest call is shown: a slower, older answer is ignored, as is any
 *   answer arriving after unmount.
 * - Use cases never reject (their contract). A rejection is a programmer error and is rethrown
 *   during render for the nearest error boundary instead of loading forever (as `useBootstrap`).
 */
export function useResultLoader<T, E>(load: () => Promise<Result<T, E>>): ResultLoader<T, E> {
  const [reloadCount, setReloadCount] = useState(0);
  const request = useMemo<Request<T, E>>(() => ({ load, reloadCount }), [load, reloadCount]);
  const [settled, setSettled] = useState<Settled<T, E> | null>(null);

  useEffect(() => {
    let isCurrent = true;
    request.load().then(
      (result) => {
        if (isCurrent) {
          setSettled({
            request,
            state: result.ok
              ? { status: 'loaded', value: result.value }
              : { status: 'failed', error: result.error },
          });
        }
      },
      (reason: unknown) =>
        setSettled(() => {
          throw reason;
        }),
    );
    return () => {
      // A newer request or unmount makes this answer stale.
      isCurrent = false;
    };
  }, [request]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  return { state: shownState(settled, request), reload };
}

/** The latest answer; while a newer request runs, a loaded value stays shown, a failure does not. */
function shownState<T, E>(settled: Settled<T, E> | null, request: Request<T, E>): LoadState<T, E> {
  if (settled === null) {
    return LOADING;
  }
  return settled.request === request || settled.state.status === 'loaded' ? settled.state : LOADING;
}
