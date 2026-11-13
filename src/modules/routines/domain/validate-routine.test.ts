import * as fc from 'fast-check';

import { durationFromSeconds } from '@shared/domain/duration';
import { aValidRoutine } from '@test/builders/routine.arbitrary';
import { aBlock, anExerciseStep, aRestStep, aRoutine, aSet } from '@test/builders/routine.builder';
import { unwrap, unwrapErr } from '@test/support/unwrap';

import type { Block, Routine, RoutineNode } from './routine';
import {
  validateRoutine,
  type NodePath,
  type RoutineValidationCode,
  type ValidatedRoutine,
} from './validate-routine';

const issuesOf = (routine: Routine) =>
  unwrapErr(validateRoutine(routine)).issues.map(({ code, path }) => ({ code, path }));

const startWorkout = (routine: ValidatedRoutine): string => routine.name;

/** Every node path in the tree, root first, depth-first. */
const pathsOf = (block: Block, path: NodePath = []): readonly NodePath[] => [
  path,
  ...block.children.flatMap((child, index) =>
    child.kind === 'block' ? pathsOf(child, [...path, index]) : [[...path, index]],
  ),
];

const replaceAt = (
  block: Block,
  path: NodePath,
  replace: (node: RoutineNode) => RoutineNode,
): Block => {
  const [index, ...rest] = path;
  if (index === undefined) {
    const replaced = replace(block);
    if (replaced.kind !== 'block') throw new Error('the root must stay a block');
    return replaced;
  }
  return {
    ...block,
    children: block.children.map((child, childIndex) => {
      if (childIndex !== index) return child;
      return rest.length === 0 || child.kind !== 'block'
        ? replace(child)
        : replaceAt(child, rest, replace);
    }),
  };
};

const ZERO = unwrap(durationFromSeconds(0));

/** Breaks exactly one rule on the node, without touching its descendants. */
const breakOneRule = (node: RoutineNode): { node: RoutineNode; code: RoutineValidationCode } => {
  switch (node.kind) {
    case 'block':
      return { node: { ...node, repeat: 0 }, code: 'routines.invalidRepeat' };
    case 'exercise':
      return { node: { ...node, sets: [] }, code: 'routines.noSets' };
    case 'rest':
      return { node: { ...node, duration: ZERO }, code: 'routines.zeroRest' };
  }
};

describe('validateRoutine', () => {
  it('returns a success containing the routine when it is valid', () => {
    const routine = aRoutine().build();

    expect(unwrap(validateRoutine(routine))).toBe(routine);
  });

  it('only lets validated routines be started (compile-time)', () => {
    const routine = aRoutine().build();

    // @ts-expect-error -- a draft Routine is not a ValidatedRoutine
    expect(startWorkout(routine)).toBe('Full body');
    expect(startWorkout(unwrap(validateRoutine(routine)))).toBe('Full body');
  });

  it('wraps the issues in a routines.invalidRoutine error', () => {
    const error = unwrapErr(validateRoutine(aRoutine().named('').build()));

    expect(error).toMatchObject({ code: 'routines.invalidRoutine', message: expect.any(String) });
    expect(error.issues[0]).toMatchObject({
      code: 'routines.emptyName',
      message: expect.any(String),
    });
  });

  describe('routine', () => {
    it.each(['', '   ', '\n\t'])('rejects the empty or whitespace-only name %j', (name) => {
      expect(issuesOf(aRoutine().named(name).build())).toEqual([
        { code: 'routines.emptyName', path: [] },
      ]);
    });
  });

  describe('blocks', () => {
    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      'rejects repeat %p and identifies the block',
      (repeat) => {
        const routine = aRoutine().with(anExerciseStep(), aBlock().repeat(repeat)).build();

        expect(issuesOf(routine)).toEqual([{ code: 'routines.invalidRepeat', path: [1] }]);
      },
    );

    it('accepts any whole number of rounds from 1 upwards, without an upper limit', () => {
      expect(validateRoutine(aRoutine().withRoot(aBlock().repeat(1)).build()).ok).toBe(true);
      expect(validateRoutine(aRoutine().withRoot(aBlock().repeat(10_000)).build()).ok).toBe(true);
    });

    it('rejects a nested block without children', () => {
      const routine = aRoutine().with(aBlock().with(aBlock().withNoChildren())).build();

      expect(issuesOf(routine)).toEqual([{ code: 'routines.emptyBlock', path: [0, 0] }]);
    });

    it('rejects an empty root block', () => {
      expect(issuesOf(aRoutine().withRoot(aBlock().withNoChildren()).build())).toEqual([
        { code: 'routines.emptyBlock', path: [] },
      ]);
    });
  });

  describe('exercise steps', () => {
    it('rejects a step without sets', () => {
      expect(issuesOf(aRoutine().with(anExerciseStep().withNoSets()).build())).toEqual([
        { code: 'routines.noSets', path: [0] },
      ]);
    });

    it.each([
      ['no duration target', aSet().withoutReps()],
      ['a zero duration', aSet().withoutReps().duration(0)],
    ])('rejects a timed set with %s and names the set', (_case, set) => {
      const step = anExerciseStep().timed().withSets(aSet().duration(30), set);

      const error = unwrapErr(validateRoutine(aRoutine().with(step).build()));

      expect(error.issues).toEqual([
        expect.objectContaining({
          code: 'routines.missingDuration',
          path: [0],
          details: { setIndex: 1 },
        }),
      ]);
    });

    it('accepts a reps set without a reps target ("until done")', () => {
      const step = anExerciseStep().withSets(aSet().withoutReps());

      expect(validateRoutine(aRoutine().with(step).build()).ok).toBe(true);
    });

    it.each([0, -3, 2.5, Number.NaN])('rejects a reps target of %p', (reps) => {
      const step = anExerciseStep().withSets(aSet(), aSet().reps(reps));

      expect(unwrapErr(validateRoutine(aRoutine().with(step).build())).issues).toEqual([
        expect.objectContaining({
          code: 'routines.invalidReps',
          path: [0],
          details: { setIndex: 1 },
        }),
      ]);
    });

    it('also checks a reps target given on a timed set', () => {
      const step = anExerciseStep().timed().withSets(aSet().duration(30).reps(0));

      expect(issuesOf(aRoutine().with(step).build())).toEqual([
        { code: 'routines.invalidReps', path: [0] },
      ]);
    });
  });

  describe('rest steps', () => {
    it('rejects a rest with a zero duration', () => {
      expect(issuesOf(aRoutine().with(anExerciseStep(), aRestStep().duration(0)).build())).toEqual([
        { code: 'routines.zeroRest', path: [1] },
      ]);
    });
  });

  describe('node ids', () => {
    it('rejects duplicate node ids anywhere in the tree, pointing at the repeated one', () => {
      const routine = aRoutine()
        .with(aRestStep().withId('dup'), aBlock().with(anExerciseStep().withId('dup')))
        .build();

      expect(unwrapErr(validateRoutine(routine)).issues).toEqual([
        expect.objectContaining({
          code: 'routines.duplicateNodeId',
          path: [1, 0],
          details: { id: 'dup', firstPath: [0] },
        }),
      ]);
    });
  });

  it('lists every problem in different nested blocks, each with its path', () => {
    const routine = aRoutine()
      .named(' ')
      .with(
        aBlock().repeat(0).with(anExerciseStep(), aRestStep().duration(0)),
        aBlock().with(aBlock().with(anExerciseStep().withNoSets()), aBlock().withNoChildren()),
      )
      .build();

    expect(issuesOf(routine)).toEqual([
      { code: 'routines.emptyName', path: [] },
      { code: 'routines.invalidRepeat', path: [0] },
      { code: 'routines.zeroRest', path: [0, 1] },
      { code: 'routines.noSets', path: [1, 0, 0] },
      { code: 'routines.emptyBlock', path: [1, 1] },
    ]);
  });

  describe('messages', () => {
    /** Every validation code once; a code added to the union without an entry is a compile error. */
    const EVERY_CODE: Readonly<Record<RoutineValidationCode, true>> = {
      'routines.emptyName': true,
      'routines.invalidRepeat': true,
      'routines.emptyBlock': true,
      'routines.noSets': true,
      'routines.missingDuration': true,
      'routines.invalidReps': true,
      'routines.zeroRest': true,
      'routines.duplicateNodeId': true,
    };

    it('explains every kind of problem with its own readable message, for the editor to show', () => {
      const routine = aRoutine()
        .named('')
        .with(
          aBlock().repeat(0).with(anExerciseStep().withNoSets()),
          aBlock().withNoChildren(),
          anExerciseStep().timed().withSets(aSet().withoutReps()),
          anExerciseStep().withSets(aSet().reps(1.5)),
          aRestStep().withId('repeated').duration(0),
          aRestStep().withId('repeated'),
        )
        .build();

      const messageByCode = new Map(
        unwrapErr(validateRoutine(routine)).issues.map(({ code, message }) => [code, message]),
      );

      expect([...messageByCode.keys()].sort()).toEqual(Object.keys(EVERY_CODE).sort());
      messageByCode.forEach((message) => expect(message).toMatch(/\S/));
      expect(new Set(messageByCode.values()).size).toBe(messageByCode.size);
    });

    it('summarises how many problems the routine has', () => {
      const error = unwrapErr(
        validateRoutine(aRoutine().named('').with(aRestStep().duration(0)).build()),
      );

      expect(error.issues).toHaveLength(2);
      expect(error.message).toMatch(/\b2\b/);
    });
  });

  describe('properties', () => {
    it('accepts every valid tree of random depth and width', () => {
      fc.assert(
        fc.property(aValidRoutine(), (routine) => {
          expect(validateRoutine(routine).ok).toBe(true);
        }),
      );
    });

    it('reports exactly the broken node when one rule is broken at a random node', () => {
      const routineWithPath = aValidRoutine().chain((routine) =>
        fc.constantFrom(...pathsOf(routine.root)).map((path) => ({ routine, path })),
      );

      fc.assert(
        fc.property(routineWithPath, ({ routine, path }) => {
          let expectedCode: RoutineValidationCode | undefined;
          const root = replaceAt(routine.root, path, (node) => {
            const broken = breakOneRule(node);
            expectedCode = broken.code;
            return broken.node;
          });

          expect(issuesOf({ ...routine, root })).toEqual([{ code: expectedCode, path }]);
        }),
      );
    });
  });
});
