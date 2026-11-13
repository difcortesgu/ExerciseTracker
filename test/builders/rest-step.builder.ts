import { parseRestStepId, type RestStep } from '@modules/routines/domain/routine';
import type { Duration } from '@shared/domain/duration';

import { unwrap } from '../support/unwrap';

import { DEFAULTS, nextId, seconds, type NodeBuilder } from './builder-support';

export class RestStepBuilder implements NodeBuilder {
  constructor(
    private readonly id: string,
    private readonly restDuration: Duration,
  ) {}

  withId(id: string): RestStepBuilder {
    return new RestStepBuilder(id, this.restDuration);
  }

  duration(restSeconds: number): RestStepBuilder {
    return new RestStepBuilder(this.id, seconds(restSeconds));
  }

  build(): RestStep {
    return { kind: 'rest', id: unwrap(parseRestStepId(this.id)), duration: this.restDuration };
  }
}

export const aRestStep = (): RestStepBuilder =>
  new RestStepBuilder(nextId('rest'), seconds(DEFAULTS.restStepSeconds));
