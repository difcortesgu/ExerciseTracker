import type { DomainError } from './domain-error';

/**
 * Result pattern (S0-08): expected failures are returned, never thrown.
 * Programmer errors (broken invariants, missing DI registrations) still throw.
 *
 * Narrow with the `ok` discriminant (or the `isOk`/`isErr` guards); `value` and `error` are only
 * reachable after narrowing.
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E = DomainError> = Ok<T> | Err<E>;

/** Creates a frozen success. Use `ok(undefined)` for `Result<void, …>`. */
export function ok<T>(value: T): Ok<T> {
  return Object.freeze({ ok: true, value });
}

/** Creates a frozen failure carrying `error`. */
export function err<E>(error: E): Err<E> {
  return Object.freeze({ ok: false, error });
}

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}

/** Transforms the value of a success; a failure passes through unchanged. */
export function map<T, U, E>(result: Result<T, E>, transform: (value: T) => U): Result<U, E> {
  return result.ok ? ok(transform(result.value)) : result;
}

/** Transforms the error of a failure; a success passes through unchanged. */
export function mapErr<T, E, F>(result: Result<T, E>, transform: (error: E) => F): Result<T, F> {
  return result.ok ? result : err(transform(result.error));
}

/** Chains a step that may fail; a failure short-circuits and passes through unchanged. */
export function andThen<T, U, E, F>(
  result: Result<T, E>,
  next: (value: T) => Result<U, F>,
): Result<U, E | F> {
  return result.ok ? next(result.value) : result;
}

/** Folds a result into a single value by handling both cases. */
export function match<T, E, R>(
  result: Result<T, E>,
  handlers: { readonly ok: (value: T) => R; readonly err: (error: E) => R },
): R {
  return result.ok ? handlers.ok(result.value) : handlers.err(result.error);
}
