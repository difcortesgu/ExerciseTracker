import type { Brand } from './brand';
import { domainError, type DomainError } from './domain-error';
import { err, ok, type Result } from './result';

/**
 * Branded string identifier (S0-10). Any module declares its own id without editing shared code:
 * `type BlockId = Id<'BlockId'>; const parseBlockId = idFactory('BlockId');` (Open/Closed).
 */
export type Id<Name extends string> = Brand<string, Name>;

export type InvalidIdError = DomainError<'shared.invalidId'>;

/** Factory pattern: returns the validating constructor for one id type. */
export function idFactory<Name extends string>(
  name: Name,
): (raw: string) => Result<Id<Name>, InvalidIdError> {
  return (raw) =>
    isIdOf<Name>(raw)
      ? ok(raw)
      : err(domainError('shared.invalidId', `${name} must not be empty.`, { idType: name }));
}

/** The only place a string becomes an id: after the non-blank check. */
function isIdOf<Name extends string>(raw: string): raw is Id<Name> {
  return raw.trim().length > 0;
}
