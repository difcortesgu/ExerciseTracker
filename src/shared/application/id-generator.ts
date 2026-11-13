import { createToken } from './di/token';

/**
 * Port: creates identifiers for new entities. Tests use a deterministic sequence
 * (`SequentialIdGenerator`) so failures are reproducible.
 */
export interface IdGenerator {
  /** Returns a new non-empty identifier, unique for the lifetime of the app's data. */
  next(): string;
}

export const IdGeneratorToken = createToken<IdGenerator>('shared.IdGenerator');
