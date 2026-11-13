import { describeCause } from './describe-cause';

describe('describeCause', () => {
  it('uses the message of an Error', () => {
    expect(describeCause(new Error('disk I/O error'))).toBe('disk I/O error');
  });

  it('follows wrapped causes so the root cause stays readable', () => {
    const wrapped = new Error('Failed to run the query', {
      cause: new Error('near "THIS": syntax error'),
    });

    expect(describeCause(wrapped)).toBe('Failed to run the query: near "THIS": syntax error');
  });

  it('describes thrown values that are not Errors', () => {
    expect(describeCause('native failure')).toBe('native failure');
    expect(describeCause(42)).toBe('42');
  });
});
