import { createToken, type Token } from './token';

describe('createToken', () => {
  it('keeps the description for error messages', () => {
    expect(createToken<number>('shared.Answer').description).toBe('shared.Answer');
  });

  it('gives each token a unique key, even with the same description', () => {
    const first = createToken<number>('shared.Answer');
    const second = createToken<number>('shared.Answer');

    expect(first.key).not.toBe(second.key);
  });

  it('describes its key with the token description for debugging', () => {
    expect(createToken<number>('shared.Answer').key.description).toBe('shared.Answer');
  });

  it('carries the implementation type for inference', () => {
    const token: Token<string> = createToken<string>('shared.Name');
    // @ts-expect-error -- a Token<string> is not a Token<number>
    const wrong: Token<number> = token;

    expect(wrong).toBe(token);
  });

  it('returns a frozen token', () => {
    expect(Object.isFrozen(createToken<number>('shared.Answer'))).toBe(true);
  });
});
