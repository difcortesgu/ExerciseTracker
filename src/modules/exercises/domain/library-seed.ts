import type { ExerciseId } from '@shared/domain/ids';

import { createBuiltInExercise, type BuiltInExercise, type BuiltInExerciseData } from './exercise';
import type { VocabularyValue } from './vocabulary';

/**
 * What one seeding run writes, computed purely from the stored built-ins and the bundled seed
 * (S1-12, ADR-004 "Seeding"). The store applies it in **one transaction** (all or nothing).
 *
 * `planLibrarySeed({ seedVersion, existing, seed, vocabulary, newId }): LibrarySeedPlan` (this file)
 * where `existing` are all stored built-ins (archived included), `seed` the `BuiltInExerciseData[]`
 * of the asset, `vocabulary` its built-in values and `newId: () => ExerciseId` (from `IdGenerator`):
 * - a seed exercise whose `sourceKey` is stored → `update` with the **same id** (un-archived if it
 *   was archived), only when something changed;
 * - a new `sourceKey` → `insert` with a new id;
 * - a stored built-in whose `sourceKey` is no longer in the seed → `archive` (never deleted);
 * - custom exercises are never part of a plan (they are not even read).
 * Name collisions with custom exercises are **not** checked (decision Q6, T9): both are kept.
 */
export interface LibrarySeedPlan {
  /** The asset's seed version; stored with the plan so the next run is a no-op. */
  readonly seedVersion: number;
  readonly insert: readonly BuiltInExercise[];
  readonly update: readonly BuiltInExercise[];
  readonly archive: readonly ExerciseId[];
  /**
   * Built-in vocabulary values of the seed (origin `builtIn`), upserted by `(kind, key)`.
   * Built-in values are never deleted (a value dropped by a later dataset may still be used by
   * custom or archived exercises); user-defined rows are never touched.
   */
  readonly vocabulary: readonly VocabularyValue[];
}

export interface LibrarySeedInput {
  readonly seedVersion: number;
  /** Every stored built-in, archived ones included. */
  readonly existing: readonly BuiltInExercise[];
  readonly seed: readonly BuiltInExerciseData[];
  /** The seed's built-in vocabulary values (origin `builtIn`). */
  readonly vocabulary: readonly VocabularyValue[];
  readonly newId: () => ExerciseId;
}

/** Everything a stored built-in consists of, in a fixed order, to detect a change. */
function contentOf(exercise: BuiltInExercise): string {
  return JSON.stringify([
    exercise.name,
    exercise.category,
    exercise.primaryMuscles,
    exercise.secondaryMuscles,
    exercise.equipment,
    exercise.level,
    exercise.force,
    exercise.mechanic,
    exercise.instructions,
    exercise.images.map(({ path, sizeBytes }) => [path, sizeBytes]),
    exercise.trackedMetrics,
    exercise.archived,
  ]);
}

/** Computes the seeding run (see the TSDoc above); pure, no I/O. */
export function planLibrarySeed(input: LibrarySeedInput): LibrarySeedPlan {
  const storedByKey = new Map(input.existing.map((exercise) => [exercise.sourceKey, exercise]));
  const seedKeys = new Set(input.seed.map(({ sourceKey }) => sourceKey));
  const insert: BuiltInExercise[] = [];
  const update: BuiltInExercise[] = [];
  input.seed.forEach((data) => {
    const current = storedByKey.get(data.sourceKey);
    if (current === undefined) {
      insert.push(createBuiltInExercise(input.newId(), data));
      return;
    }
    const next = createBuiltInExercise(current.id, data);
    if (contentOf(next) !== contentOf(current)) update.push(next);
  });
  const archive = input.existing
    .filter((exercise) => !exercise.archived && !seedKeys.has(exercise.sourceKey))
    .map(({ id }) => id);
  return Object.freeze({
    seedVersion: input.seedVersion,
    insert: Object.freeze(insert),
    update: Object.freeze(update),
    archive: Object.freeze(archive),
    vocabulary: Object.freeze([...input.vocabulary]),
  });
}
