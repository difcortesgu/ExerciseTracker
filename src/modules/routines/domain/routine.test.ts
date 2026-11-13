import { assertNever } from '@shared/domain/assert-never';
import { aBlock, anExerciseStep, aRestStep, aRoutine, aSet } from '@test/builders/routine.builder';
import { isErr, type Result } from '@shared/domain/result';
import { unwrap } from '@test/support/unwrap';

import {
  parseBlockId,
  parseExerciseStepId,
  parseRestStepId,
  type RoutineNode,
  type SetTarget,
} from './routine';

/** Deliberately misses the `rest` case to prove exhaustiveness is checked at compile time. */
const describeWithoutRest = (node: RoutineNode): string => {
  switch (node.kind) {
    case 'block':
      return 'block';
    case 'exercise':
      return 'exercise';
    default:
      // @ts-expect-error -- `rest` is not handled, so `node` is not `never`
      return assertNever(node);
  }
};

const depthOf = (node: RoutineNode): number =>
  node.kind === 'block' ? 1 + Math.max(0, ...node.children.map(depthOf)) : 0;

describe('routine tree (Composite)', () => {
  it('nests blocks inside blocks to any depth', () => {
    const routine = aRoutine()
      .with(
        aBlock()
          .repeat(3)
          .with(aBlock().repeat(2).with(aBlock().with(anExerciseStep()), aRestStep())),
      )
      .build();

    expect(depthOf(routine.root)).toBe(4);
  });

  it('holds exercises, rests and blocks side by side in one block', () => {
    const block = aBlock().with(anExerciseStep(), aRestStep(), aBlock()).build();

    expect(block.children.map((child) => child.kind)).toEqual(['exercise', 'rest', 'block']);
  });

  it('gives every node its own id', () => {
    const routine = aRoutine().with(anExerciseStep(), aRestStep()).build();
    const ids = [routine.root.id, ...routine.root.children.map((child) => child.id)];

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('turns a missing case in a switch on the node kind into a compile error', () => {
    expect(describeWithoutRest(aBlock().build())).toBe('block');
    expect(() => describeWithoutRest(aRestStep().build())).toThrow(/rest/);
  });

  it('is read-only at compile time', () => {
    const routine = aRoutine().build();
    const step = anExerciseStep().build();
    // Never called: the statements exist only so tsc proves they are rejected.
    const mutate = (): void => {
      // @ts-expect-error -- Routine fields are read-only
      routine.name = 'Renamed';
      // @ts-expect-error -- Block children are a read-only array
      routine.root.children.push(aRestStep().build());
      // @ts-expect-error -- ExerciseStep sets are a read-only array
      step.sets.push(aSet().build());
    };

    expect(mutate).toBeInstanceOf(Function);
    expect(routine.name).toBe('Full body');
  });

  it('types weight, duration and distance targets as value objects', () => {
    // @ts-expect-error -- a raw number is not a Weight
    const rawWeight: SetTarget = { weight: 100 };
    const target: SetTarget = aSet()
      .weight(100, 'kg')
      .duration(40)
      .distance(5, 'km')
      .build().target;

    expect(rawWeight.weight).toBe(100);
    expect(Object.keys(target)).toEqual(['reps', 'weight', 'duration', 'distance']);
  });
});

describe('routine node ids', () => {
  const parsers: readonly (readonly [string, (raw: string) => Result<string, unknown>])[] = [
    ['BlockId', parseBlockId],
    ['ExerciseStepId', parseExerciseStepId],
    ['RestStepId', parseRestStepId],
  ];

  it.each(parsers)(
    'creates a %s from a non-blank string and rejects a blank one',
    (_name, parse) => {
      expect(unwrap(parse('node-1'))).toBe('node-1');
      expect(isErr(parse('  '))).toBe(true);
    },
  );
});
