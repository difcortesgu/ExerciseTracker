/**
 * Typed dependency-injection token (S0-15).
 *
 * A token identifies a port or use case in the container and carries its type, so
 * `resolver.resolve(token)` is typed without casts at the call site. Tokens are declared next to
 * the port or use case they identify (in that module's application layer) and exported from the
 * module's index.ts; adding a module never edits a central token list (Open/Closed).
 */
declare const tokenType: unique symbol;

export interface Token<T> {
  /** Unique identity of the token; two tokens with the same description are different tokens. */
  readonly key: symbol;
  /** Human-readable name used in error messages, e.g. `exercises.ListExercises`. */
  readonly description: string;
  /** Phantom field that carries `T` for inference; never present at runtime. */
  readonly [tokenType]?: T;
}

/** Creates a new, unique token; `description` follows `<module>.<Name>`, e.g. `shared.Clock`. */
export function createToken<T>(description: string): Token<T> {
  return Object.freeze({ key: Symbol(description), description });
}
