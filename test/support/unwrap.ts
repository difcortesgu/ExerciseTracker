import type { Result } from '@shared/domain/result';

/** Test helper: the value of a success; fails the test loudly on a failure. */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) {
    throw new Error(`Expected a success but got: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

/** Test helper: the error of a failure; fails the test loudly on a success. */
export function unwrapErr<T, E>(result: Result<T, E>): E {
  if (result.ok) {
    throw new Error(`Expected a failure but got a success: ${JSON.stringify(result.value)}`);
  }
  return result.error;
}
