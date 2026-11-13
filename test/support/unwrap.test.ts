import { domainError } from '@shared/domain/domain-error';
import { err, ok } from '@shared/domain/result';

import { unwrap, unwrapErr } from './unwrap';

describe('unwrap', () => {
  it('returns the value of a success', () => {
    expect(unwrap(ok(3))).toBe(3);
  });

  it('throws with the error code when given a failure', () => {
    expect(() => unwrap(err(domainError('shared.example', 'Boom')))).toThrow(/shared\.example/);
  });
});

describe('unwrapErr', () => {
  it('returns the error of a failure', () => {
    expect(unwrapErr(err('boom'))).toBe('boom');
  });

  it('throws when given a success', () => {
    expect(() => unwrapErr(ok(3))).toThrow(/success/);
  });
});
