import * as fc from 'fast-check';

import { andThen, err, isErr, isOk, map, mapErr, match, ok, type Result } from './result';

const anyResult = fc.oneof(fc.integer().map(ok), fc.string().map(err));

/** Widens to the union so the compiler cannot narrow from the assignment. */
const widen = <T, E>(result: Result<T, E>): Result<T, E> => result;

const describeResult = (result: Result<number, string>): string =>
  match(result, { ok: (value) => `ok:${value}`, err: (error) => `err:${error}` });

describe('Result', () => {
  describe('ok', () => {
    it('creates a success that the type guards recognise', () => {
      const result: Result<number, string> = ok(42);

      expect(isOk(result)).toBe(true);
      expect(isErr(result)).toBe(false);
    });

    it('exposes the value only after narrowing', () => {
      const result = widen<number, string>(ok(42));

      // @ts-expect-error -- `value` is not reachable before narrowing to Ok
      const beforeNarrowing: unknown = result.value;
      if (!isOk(result)) {
        throw new Error('expected a success');
      }

      expect(result.value).toBe(42);
      expect(beforeNarrowing).toBe(42);
    });

    it('supports results without a value', () => {
      expect(ok(undefined)).toEqual({ ok: true, value: undefined });
    });
  });

  describe('err', () => {
    it('creates a failure that carries the error', () => {
      const failure = { code: 'shared.example', message: 'Something failed' };
      const result: Result<number, typeof failure> = err(failure);

      expect(isErr(result)).toBe(true);
      expect(isOk(result)).toBe(false);
      expect(result).toEqual({ ok: false, error: failure });
    });
  });

  describe('immutability', () => {
    it('returns frozen successes and failures', () => {
      expect(Object.isFrozen(ok(1))).toBe(true);
      expect(Object.isFrozen(err('boom'))).toBe(true);
    });

    it('rejects mutation at compile time', () => {
      const success = ok(1);
      const failure = err('boom');
      // Never called: the assignments exist only so tsc proves they are rejected.
      const mutate = (): void => {
        // @ts-expect-error -- Ok is read-only
        success.value = 2;
        // @ts-expect-error -- Err is read-only
        failure.error = 'other';
      };

      expect(mutate).toBeInstanceOf(Function);
      expect(success).toEqual({ ok: true, value: 1 });
      expect(failure).toEqual({ ok: false, error: 'boom' });
    });
  });

  describe('map', () => {
    it('applies the transform to a success', () => {
      expect(map(ok(2), (value: number) => value * 3)).toEqual(ok(6));
    });

    it('passes a failure through unchanged without calling the transform', () => {
      const transform = jest.fn((value: number) => value * 3);
      const failure: Result<number, string> = err('boom');

      expect(map(failure, transform)).toBe(failure);
      expect(transform).not.toHaveBeenCalled();
    });

    it('obeys the identity law', () => {
      fc.assert(
        fc.property(anyResult, (result) => {
          expect(map(result, (value) => value)).toEqual(result);
        }),
      );
    });

    it('obeys the composition law', () => {
      const double = (value: number): number => value * 2;
      const increment = (value: number): number => value + 1;

      fc.assert(
        fc.property(anyResult, (result) => {
          expect(map(map(result, double), increment)).toEqual(
            map(result, (value) => increment(double(value))),
          );
        }),
      );
    });
  });

  describe('mapErr', () => {
    it('applies the transform to a failure', () => {
      expect(mapErr(err('boom'), (error: string) => error.length)).toEqual(err(4));
    });

    it('passes a success through unchanged without calling the transform', () => {
      const transform = jest.fn((error: string) => error.length);
      const success: Result<number, string> = ok(1);

      expect(mapErr(success, transform)).toBe(success);
      expect(transform).not.toHaveBeenCalled();
    });
  });

  describe('andThen', () => {
    const halveEven = (value: number): Result<number, string> =>
      value % 2 === 0 ? ok(value / 2) : err(`odd:${value}`);
    const nonZero = (value: number): Result<number, string> =>
      value === 0 ? err('zero') : ok(value);

    it('chains a success into the next result', () => {
      expect(andThen(ok(8), halveEven)).toEqual(ok(4));
      expect(andThen(ok(3), halveEven)).toEqual(err('odd:3'));
    });

    it('passes a failure through unchanged without calling the next step', () => {
      const next = jest.fn(halveEven);
      const failure: Result<number, string> = err('boom');

      expect(andThen(failure, next)).toBe(failure);
      expect(next).not.toHaveBeenCalled();
    });

    it('obeys the left identity law', () => {
      fc.assert(
        fc.property(fc.integer(), (value) => {
          expect(andThen(ok(value), halveEven)).toEqual(halveEven(value));
        }),
      );
    });

    it('obeys the right identity law', () => {
      fc.assert(
        fc.property(anyResult, (result) => {
          expect(andThen(result, ok)).toEqual(result);
        }),
      );
    });

    it('obeys the associativity law', () => {
      fc.assert(
        fc.property(anyResult, (result) => {
          expect(andThen(andThen(result, halveEven), nonZero)).toEqual(
            andThen(result, (value) => andThen(halveEven(value), nonZero)),
          );
        }),
      );
    });
  });

  describe('match', () => {
    it('calls the ok handler for a success', () => {
      expect(describeResult(ok(7))).toBe('ok:7');
    });

    it('calls the err handler for a failure', () => {
      expect(describeResult(err('boom'))).toBe('err:boom');
    });
  });
});
