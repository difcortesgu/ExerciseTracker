/**
 * Common shape of every expected (domain or application) failure (S0-09).
 *
 * Errors are plain immutable data, so two errors with the same code and details are structurally
 * equal (`toEqual`) and the UI can map `code` to a message without matching strings.
 * Modules declare their own codes as string-literal unions in their own domain
 * (e.g. `DomainError<RoutineErrorCode>`), without editing shared code (Open/Closed).
 *
 * Code convention: `<module>.<camelCaseReason>`, e.g. `shared.invalidId`, `routines.emptyBlock`.
 */
export interface DomainError<Code extends string = string> {
  /** Stable machine-readable code. */
  readonly code: Code;
  /** Human-readable English description for logs and fallback UI. */
  readonly message: string;
  /** Optional structured context (ids, paths, offending values). */
  readonly details?: Readonly<Record<string, unknown>>;
}

/** Creates a frozen domain error; `details` is omitted entirely when not given. */
export function domainError<Code extends string>(
  code: Code,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): DomainError<Code> {
  return details === undefined
    ? Object.freeze({ code, message })
    : Object.freeze({ code, message, details: Object.freeze({ ...details }) });
}
