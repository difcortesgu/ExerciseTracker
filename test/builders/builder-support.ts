import type { RoutineNode } from '@modules/routines/domain/routine';
import { durationFromSeconds, type Duration } from '@shared/domain/duration';

import { unwrap } from '../support/unwrap';

/**
 * Shared plumbing of the routine builders (Builder pattern, S0-21). Ids come from a deterministic
 * sequence, reset per test file by Jest's module registry, so failures are reproducible.
 */

export const DEFAULTS = Object.freeze({
  routineName: 'Full body',
  exerciseId: 'exercise-squat',
  reps: 10,
  restAfterSetSeconds: 60,
  timedWorkSeconds: 40,
  restStepSeconds: 30,
});

let lastSequenceNumber = 0;

export const nextId = (prefix: string): string => `${prefix}-${++lastSequenceNumber}`;

export const seconds = (value: number): Duration => unwrap(durationFromSeconds(value));

/** Anything that builds a routine node, so blocks accept builders of any node kind. */
export interface NodeBuilder {
  build(): RoutineNode;
}
