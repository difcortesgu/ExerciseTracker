import type { Routine } from '@modules/routines/domain/routine';
import { parseRoutineId } from '@shared/domain/ids';

import { unwrap } from '../support/unwrap';

import { aBlock, type BlockBuilder } from './block.builder';
import { DEFAULTS, nextId, type NodeBuilder } from './builder-support';

/**
 * Builder pattern: fluent, immutable test data builders for the routine tree (S0-21), e.g.
 * `aRoutine().with(aBlock().repeat(3).with(anExerciseStep(), aRestStep())).build()`.
 * `build()` returns a valid tree by default; tests override only what matters. Every method
 * returns a new builder; ids are deterministic or set explicitly with `withId`.
 */
export { aBlock, type BlockBuilder } from './block.builder';
export type { NodeBuilder } from './builder-support';
export { anExerciseStep, type ExerciseStepBuilder } from './exercise-step.builder';
export { aRestStep, type RestStepBuilder } from './rest-step.builder';
export { aSet, type SetBuilder } from './set.builder';

interface RoutineProps {
  readonly id: string;
  readonly name: string;
  readonly notes: string;
  readonly root: BlockBuilder;
}

export class RoutineBuilder {
  constructor(private readonly props: RoutineProps) {}

  withId(id: string): RoutineBuilder {
    return new RoutineBuilder({ ...this.props, id });
  }

  named(name: string): RoutineBuilder {
    return new RoutineBuilder({ ...this.props, name });
  }

  withNotes(notes: string): RoutineBuilder {
    return new RoutineBuilder({ ...this.props, notes });
  }

  withRoot(root: BlockBuilder): RoutineBuilder {
    return new RoutineBuilder({ ...this.props, root });
  }

  /** Sets the children of the root block. */
  with(...children: readonly NodeBuilder[]): RoutineBuilder {
    return this.withRoot(this.props.root.with(...children));
  }

  build(): Routine {
    const { id, name, notes, root } = this.props;
    return { id: unwrap(parseRoutineId(id)), name, notes, root: root.build() };
  }
}

export const aRoutine = (): RoutineBuilder =>
  new RoutineBuilder({
    id: nextId('routine'),
    name: DEFAULTS.routineName,
    notes: '',
    root: aBlock(),
  });
