/**
 * Readable description of a caught value (anything can be thrown), including wrapped `cause`s,
 * e.g. Drizzle wraps the SQLite error. Used to put unexpected failures into `DomainError.details`.
 */
export function describeCause(cause: unknown): string {
  if (!(cause instanceof Error)) {
    return String(cause);
  }
  return cause.cause === undefined
    ? cause.message
    : `${cause.message}: ${describeCause(cause.cause)}`;
}
