import * as fc from 'fast-check';

import type { Routine } from '@modules/routines/domain/routine';

import {
  aBlock,
  anExerciseStep,
  aRestStep,
  aRoutine,
  aSet,
  type NodeBuilder,
} from './routine.builder';

/**
 * fast-check arbitraries producing **valid** routine trees of random depth and width (S0-22),
 * built through the routine builders so every node gets a unique id.
 */

const LIMITS = Object.freeze({
  maxDepth: 4,
  maxChildren: 4,
  maxSets: 3,
  maxRepeat: 10,
  maxReps: 50,
  maxSeconds: 600,
  maxKilograms: 300,
});

const positiveSeconds = fc.integer({ min: 1, max: LIMITS.maxSeconds });
const restSeconds = fc.integer({ min: 0, max: LIMITS.maxSeconds });
const optionalReps = fc.option(fc.integer({ min: 1, max: LIMITS.maxReps }), { nil: undefined });
const optionalKilograms = fc.option(fc.double({ min: 0, max: LIMITS.maxKilograms, noNaN: true }), {
  nil: undefined,
});

const aValidSet = (requiresDuration: boolean) =>
  fc
    .record({
      reps: optionalReps,
      kilograms: optionalKilograms,
      workSeconds: requiresDuration
        ? positiveSeconds
        : fc.option(positiveSeconds, { nil: undefined }),
      rest: restSeconds,
    })
    .map(({ reps, kilograms, workSeconds, rest }) => {
      const base = aSet().withoutReps().restAfter(rest);
      const withReps = reps === undefined ? base : base.reps(reps);
      const withWeight = kilograms === undefined ? withReps : withReps.weight(kilograms, 'kg');
      return workSeconds === undefined ? withWeight : withWeight.duration(workSeconds);
    });

const aValidExerciseStep: fc.Arbitrary<NodeBuilder> = fc
  .constantFrom('timed', 'reps')
  .chain((mode) =>
    fc
      .array(aValidSet(mode === 'timed'), { minLength: 1, maxLength: LIMITS.maxSets })
      .map((sets) => {
        const step = anExerciseStep().withSets(...sets);
        return mode === 'timed' ? step.timed() : step;
      }),
  );

const aValidRestStep: fc.Arbitrary<NodeBuilder> = positiveSeconds.map((duration) =>
  aRestStep().duration(duration),
);

const { block: aValidBlock } = fc.letrec<{ node: NodeBuilder; block: NodeBuilder }>((tie) => ({
  node: fc.oneof(
    { depthSize: 'small', maxDepth: LIMITS.maxDepth },
    aValidExerciseStep,
    aValidRestStep,
    tie('block'),
  ),
  block: fc
    .record({
      repeat: fc.integer({ min: 1, max: LIMITS.maxRepeat }),
      rest: restSeconds,
      children: fc.array(tie('node'), { minLength: 1, maxLength: LIMITS.maxChildren }),
    })
    .map(({ repeat, rest, children }) =>
      aBlock()
        .repeat(repeat)
        .restBetweenRounds(rest)
        .with(...children),
    ),
}));

/** A valid routine whose root block holds a random, valid tree. */
export const aValidRoutine = (): fc.Arbitrary<Routine> =>
  fc
    .array(fc.oneof(aValidExerciseStep, aValidRestStep, aValidBlock), {
      minLength: 1,
      maxLength: LIMITS.maxChildren,
    })
    .map((children) =>
      aRoutine()
        .with(...children)
        .build(),
    );
