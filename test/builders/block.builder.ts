import { parseBlockId, type Block } from '@modules/routines/domain/routine';
import type { Duration } from '@shared/domain/duration';

import { unwrap } from '../support/unwrap';

import { nextId, seconds, type NodeBuilder } from './builder-support';
import { anExerciseStep } from './exercise-step.builder';

interface BlockProps {
  readonly id: string;
  readonly label: string;
  readonly repeat: number;
  readonly restBetweenRounds: Duration;
  /** `undefined` means "one default exercise step". */
  readonly children: readonly NodeBuilder[] | undefined;
}

export class BlockBuilder implements NodeBuilder {
  constructor(private readonly props: BlockProps) {}

  withId(id: string): BlockBuilder {
    return new BlockBuilder({ ...this.props, id });
  }

  label(label: string): BlockBuilder {
    return new BlockBuilder({ ...this.props, label });
  }

  repeat(repeat: number): BlockBuilder {
    return new BlockBuilder({ ...this.props, repeat });
  }

  restBetweenRounds(restSeconds: number): BlockBuilder {
    return new BlockBuilder({ ...this.props, restBetweenRounds: seconds(restSeconds) });
  }

  with(...children: readonly NodeBuilder[]): BlockBuilder {
    return new BlockBuilder({ ...this.props, children });
  }

  withNoChildren(): BlockBuilder {
    return this.with();
  }

  build(): Block {
    const { id, label, repeat, restBetweenRounds, children = [anExerciseStep()] } = this.props;
    return {
      kind: 'block',
      id: unwrap(parseBlockId(id)),
      label,
      repeat,
      restBetweenRounds,
      children: children.map((child) => child.build()),
    };
  }
}

export const aBlock = (): BlockBuilder =>
  new BlockBuilder({
    id: nextId('block'),
    label: '',
    repeat: 1,
    restBetweenRounds: seconds(0),
    children: undefined,
  });
