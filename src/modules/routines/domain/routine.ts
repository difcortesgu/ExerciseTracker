import type { Distance } from '@shared/domain/distance';
import type { Duration } from '@shared/domain/duration';
import { idFactory, type Id } from '@shared/domain/id';
import type { ExerciseId, RoutineId } from '@shared/domain/ids';
import type { Weight } from '@shared/domain/weight';

/**
 * Routine tree (S0-21), PLAN.md data model.
 *
 * Composite pattern: a `Block` contains `RoutineNode`s (blocks, exercise steps, rests) to any
 * depth, which expresses circuits, supersets, EMOM, Tabata and pyramids with one recursive type.
 * All types are read-only; construction never validates, so drafts can be represented and saved.
 * `validateRoutine` checks a tree before it can be played.
 */

export type BlockId = Id<'BlockId'>;
export const parseBlockId = idFactory('BlockId');

export type ExerciseStepId = Id<'ExerciseStepId'>;
export const parseExerciseStepId = idFactory('ExerciseStepId');

export type RestStepId = Id<'RestStepId'>;
export const parseRestStepId = idFactory('RestStepId');

/** `timed`: work for a duration. `reps`: until done, the user taps to finish. */
export type ExerciseMode = 'timed' | 'reps';

/** Per-set targets; every field is optional (an absent `reps` means "until done"). */
export interface SetTarget {
  readonly reps?: number;
  readonly weight?: Weight;
  readonly duration?: Duration;
  readonly distance?: Distance;
}

export interface ExerciseSet {
  readonly target: SetTarget;
  readonly restAfter: Duration;
}

/** Composite node: repeats its children `repeat` times, resting between rounds. */
export interface Block {
  readonly kind: 'block';
  readonly id: BlockId;
  readonly label: string;
  readonly repeat: number;
  readonly restBetweenRounds: Duration;
  readonly children: readonly RoutineNode[];
}

/** Leaf node: an exercise performed for one or more sets. */
export interface ExerciseStep {
  readonly kind: 'exercise';
  readonly id: ExerciseStepId;
  readonly exerciseId: ExerciseId;
  readonly mode: ExerciseMode;
  readonly sets: readonly ExerciseSet[];
}

/** Leaf node: a standalone rest. */
export interface RestStep {
  readonly kind: 'rest';
  readonly id: RestStepId;
  readonly duration: Duration;
}

/** Composite pattern: a Block contains nodes of any kind to any depth. */
export type RoutineNode = Block | ExerciseStep | RestStep;

export interface Routine {
  readonly id: RoutineId;
  readonly name: string;
  readonly notes: string;
  readonly root: Block;
}
