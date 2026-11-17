/**
 * Work that starts right after a successful startup **without delaying it** (S1-13, S1-22,
 * ADR-004 "Seeding"): seeding the built-in library and removing orphan photos.
 *
 * Phase 2 (core-dev): `createBootstrapper` gains `startupTasks?: readonly StartupTask[]`
 * (default none). After the migrations succeed it resolves `ok` **first**, then runs the tasks one
 * after another in the given order, never awaited by the caller. A task that rejects (a broken
 * contract: tasks return `Result`s) is caught and logged as `core.startupTaskFailed` with the task
 * name; the next task still runs. Nothing runs when startup failed. The composition root registers
 * `[exercises.EnsureLibrarySeeded, exercises.CleanUpOrphanPhotos]` in that order.
 */
export interface StartupTask {
  /** Stable name for logs, e.g. `exercises.EnsureLibrarySeeded`. */
  readonly name: string;
  /** Starts the work; the promise is only observed for logging. */
  run(): Promise<unknown>;
}
