/**
 * Public API of the `workout` module. Other modules, `app/` routes and the composition root
 * may import this module only through this file (enforced by eslint-plugin-boundaries).
 *
 * Rules (docs/ENGINEERING_STANDARDS.md §1.3, ADR-001):
 * - Re-exports only (`export … from`); no logic here (enforced by lint).
 * - Export use cases, DTOs, port interfaces, DI tokens and presentation screens.
 * - Never export infrastructure adapters; they are wired in `src/core/di` only.
 */

export { WorkoutScreen } from './presentation/workout-screen';
