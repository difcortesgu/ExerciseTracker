declare const brand: unique symbol;

/**
 * Nominal ("branded") type: `T` tagged with a compile-time-only name, so structurally equal values
 * of different meaning (e.g. an `ExerciseId` and a `RoutineId`) cannot be mixed up (S0-10).
 * The brand never exists at runtime; values are branded only by validating factories.
 */
export type Brand<T, Name extends string> = T & { readonly [brand]: Name };
