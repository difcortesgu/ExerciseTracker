import { domainError, type DomainError } from './domain-error';

type SampleModuleErrorCode = 'sample.notFound' | 'sample.tooLong';

describe('domainError', () => {
  it('creates an error with a machine-readable code and a human-readable message', () => {
    const error = domainError('shared.example', 'Something went wrong');

    expect(error).toEqual({ code: 'shared.example', message: 'Something went wrong' });
  });

  it('keeps structured details when given', () => {
    const error = domainError('shared.example', 'Too long', { maxLength: 10 });

    expect(error.details).toEqual({ maxLength: 10 });
  });

  it('omits details when none are given', () => {
    expect(domainError('shared.example', 'No details')).not.toHaveProperty('details');
  });

  it('lets a module declare its own codes without editing shared code', () => {
    const error: DomainError<SampleModuleErrorCode> = domainError('sample.notFound', 'Not found');

    // @ts-expect-error -- a code outside the module's union is rejected
    const invalid: DomainError<SampleModuleErrorCode> = domainError('sample.unknown', 'Nope');

    expect(error.code).toBe('sample.notFound');
    expect(invalid.code).toBe('sample.unknown');
  });

  it('makes errors with the same code and details structurally equal', () => {
    expect(domainError('sample.tooLong', 'Too long', { maxLength: 10 })).toEqual(
      domainError('sample.tooLong', 'Too long', { maxLength: 10 }),
    );
  });

  it('returns a frozen error with frozen details', () => {
    const error = domainError('shared.example', 'Frozen', { field: 'name' });

    expect(Object.isFrozen(error)).toBe(true);
    expect(Object.isFrozen(error.details)).toBe(true);
  });
});
