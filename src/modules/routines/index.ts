/**
 * Public API of the `routines` module. Other modules, `app/` routes and the composition root
 * may import this module only through this file (enforced by eslint-plugin-boundaries).
 *
 * Rules (docs/ENGINEERING_STANDARDS.md §1.3, ADR-001):
 * - Re-exports only (`export … from`); no logic here (enforced by lint).
 * - Export use cases, DTOs, port interfaces, DI tokens and presentation screens.
 * - Never export infrastructure adapters; they are wired in `src/core/di` only.
 */

export { RoutinesScreen } from './presentation/routines-screen';

// Domain: routine tree (S0-21)
export {
  parseBlockId,
  parseExerciseStepId,
  parseRestStepId,
  type Block,
  type BlockId,
  type ExerciseMode,
  type ExerciseSet,
  type ExerciseStep,
  type ExerciseStepId,
  type RestStep,
  type RestStepId,
  type Routine,
  type RoutineNode,
  type SetTarget,
} from './domain/routine';

// Domain: routine validation (S0-22)
export {
  validateRoutine,
  type NodePath,
  type RoutineValidationCode,
  type RoutineValidationError,
  type RoutineValidationIssue,
  type ValidatedRoutine,
} from './domain/validate-routine';
