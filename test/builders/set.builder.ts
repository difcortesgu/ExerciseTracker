import type { ExerciseSet, SetTarget } from '@modules/routines/domain/routine';
import { createDistance, type DistanceUnit } from '@shared/domain/distance';
import type { Duration } from '@shared/domain/duration';
import { createWeight, type WeightUnit } from '@shared/domain/weight';

import { unwrap } from '../support/unwrap';

import { DEFAULTS, seconds } from './builder-support';

/** Builder for one exercise set: valid by default (10 reps, 60 s rest), immutable. */
export class SetBuilder {
  constructor(
    private readonly target: SetTarget,
    private readonly restAfterSet: Duration,
  ) {}

  reps(reps: number): SetBuilder {
    return new SetBuilder({ ...this.target, reps }, this.restAfterSet);
  }

  /** No reps target: "until done, tap to finish". */
  withoutReps(): SetBuilder {
    const { reps: _removed, ...target } = this.target;
    return new SetBuilder(target, this.restAfterSet);
  }

  weight(value: number, unit: WeightUnit): SetBuilder {
    return new SetBuilder(
      { ...this.target, weight: unwrap(createWeight(value, unit)) },
      this.restAfterSet,
    );
  }

  duration(workSeconds: number): SetBuilder {
    return new SetBuilder({ ...this.target, duration: seconds(workSeconds) }, this.restAfterSet);
  }

  distance(value: number, unit: DistanceUnit): SetBuilder {
    return new SetBuilder(
      { ...this.target, distance: unwrap(createDistance(value, unit)) },
      this.restAfterSet,
    );
  }

  restAfter(restSeconds: number): SetBuilder {
    return new SetBuilder(this.target, seconds(restSeconds));
  }

  build(): ExerciseSet {
    return { target: this.target, restAfter: this.restAfterSet };
  }
}

export const aSet = (): SetBuilder =>
  new SetBuilder({ reps: DEFAULTS.reps }, seconds(DEFAULTS.restAfterSetSeconds));
