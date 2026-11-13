/**
 * Exhaustiveness check for switches on discriminated unions: a missing case makes the argument
 * not `never`, which is a compile error. Reaching it at runtime is a programmer error.
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
