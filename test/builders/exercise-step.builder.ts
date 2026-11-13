import {
  parseExerciseStepId,
  type ExerciseMode,
  type ExerciseStep,
} from '@modules/routines/domain/routine';
import { parseExerciseId } from '@shared/domain/ids';

import { unwrap } from '../support/unwrap';

import { DEFAULTS, nextId, type NodeBuilder } from './builder-support';
import { aSet, type SetBuilder } from './set.builder';

interface ExerciseStepProps {
  readonly id: string;
  readonly exerciseId: string;
  readonly mode: ExerciseMode;
  /** `undefined` means "default sets for the mode". */
  readonly sets: readonly SetBuilder[] | undefined;
}

const defaultSetsFor = (mode: ExerciseMode): readonly SetBuilder[] =>
  mode === 'timed' ? [aSet().withoutReps().duration(DEFAULTS.timedWorkSeconds)] : [aSet()];

export class ExerciseStepBuilder implements NodeBuilder {
  constructor(private readonly props: ExerciseStepProps) {}

  withId(id: string): ExerciseStepBuilder {
    return new ExerciseStepBuilder({ ...this.props, id });
  }

  forExercise(exerciseId: string): ExerciseStepBuilder {
    return new ExerciseStepBuilder({ ...this.props, exerciseId });
  }

  timed(): ExerciseStepBuilder {
    return new ExerciseStepBuilder({ ...this.props, mode: 'timed' });
  }

  reps(): ExerciseStepBuilder {
    return new ExerciseStepBuilder({ ...this.props, mode: 'reps' });
  }

  withSets(...sets: readonly SetBuilder[]): ExerciseStepBuilder {
    return new ExerciseStepBuilder({ ...this.props, sets });
  }

  withNoSets(): ExerciseStepBuilder {
    return this.withSets();
  }

  build(): ExerciseStep {
    const { id, exerciseId, mode, sets = defaultSetsFor(mode) } = this.props;
    return {
      kind: 'exercise',
      id: unwrap(parseExerciseStepId(id)),
      exerciseId: unwrap(parseExerciseId(exerciseId)),
      mode,
      sets: sets.map((set) => set.build()),
    };
  }
}

export const anExerciseStep = (): ExerciseStepBuilder =>
  new ExerciseStepBuilder({
    id: nextId('exercise'),
    exerciseId: DEFAULTS.exerciseId,
    mode: 'reps',
    sets: undefined,
  });
