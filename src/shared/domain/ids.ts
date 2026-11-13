import { idFactory, type Id } from './id';

/**
 * Identifiers referenced by several modules. Module domains may not import each other, so ids
 * that cross module boundaries live in the shared kernel (ADR-001).
 *
 * Factories are named `parse<IdType>` rather than sharing the type's name, because a value and a
 * type alias with the same name is reported by `@typescript-eslint/no-redeclare`.
 */
export type ExerciseId = Id<'ExerciseId'>;
export const parseExerciseId = idFactory('ExerciseId');

export type RoutineId = Id<'RoutineId'>;
export const parseRoutineId = idFactory('RoutineId');
