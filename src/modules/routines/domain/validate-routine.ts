import type { Brand } from '@shared/domain/brand';
import { domainError, type DomainError } from '@shared/domain/domain-error';
import { toMilliseconds, type Duration } from '@shared/domain/duration';
import { err, ok, type Result } from '@shared/domain/result';

import type { Block, ExerciseSet, ExerciseStep, RestStep, Routine, RoutineNode } from './routine';

/** Child indexes from the root block; `[]` is the root (and the routine itself). */
export type NodePath = readonly number[];

export type RoutineValidationCode =
  | 'routines.emptyName'
  | 'routines.invalidRepeat'
  | 'routines.emptyBlock'
  | 'routines.noSets'
  | 'routines.missingDuration'
  | 'routines.invalidReps'
  | 'routines.zeroRest'
  | 'routines.duplicateNodeId';

export interface RoutineValidationIssue extends DomainError<RoutineValidationCode> {
  readonly path: NodePath;
}

export interface RoutineValidationError extends DomainError<'routines.invalidRoutine'> {
  readonly issues: readonly RoutineValidationIssue[];
}

/** A routine that passed {@link validateRoutine}; the player (Sprint 3) only accepts this. */
export type ValidatedRoutine = Brand<Routine, 'ValidatedRoutine'>;

const MESSAGES: Readonly<Record<RoutineValidationCode, string>> = {
  'routines.emptyName': 'Give the routine a name.',
  'routines.invalidRepeat': 'A block must repeat a whole number of times, at least once.',
  'routines.emptyBlock': 'A block needs at least one exercise, rest or block.',
  'routines.noSets': 'An exercise needs at least one set.',
  'routines.missingDuration': 'Every set of a timed exercise needs a work duration above zero.',
  'routines.invalidReps': 'A reps target must be a whole number, at least 1.',
  'routines.zeroRest': 'A rest must last longer than zero seconds.',
  'routines.duplicateNodeId': 'Two parts of the routine share the same id.',
};

const MINIMUM_REPEAT = 1;
const MINIMUM_REPS = 1;

interface LocatedNode {
  readonly node: RoutineNode;
  readonly path: NodePath;
}

type Issues = readonly RoutineValidationIssue[];

function issue(
  code: RoutineValidationCode,
  path: NodePath,
  details?: Readonly<Record<string, unknown>>,
): RoutineValidationIssue {
  return Object.freeze({ ...domainError(code, MESSAGES[code], details), path });
}

/** Iterator over the Composite: every node with its path, depth-first, parents first. */
function locateNodes(node: RoutineNode, path: NodePath = []): readonly LocatedNode[] {
  const self: LocatedNode = { node, path };
  return node.kind === 'block'
    ? [self, ...node.children.flatMap((child, index) => locateNodes(child, [...path, index]))]
    : [self];
}

const isPositive = (duration: Duration | undefined): boolean =>
  duration !== undefined && toMilliseconds(duration) > 0;

const isWholeNumberFrom = (minimum: number, value: number): boolean =>
  Number.isInteger(value) && value >= minimum;

function blockIssues(block: Block, path: NodePath): Issues {
  return [
    ...(isWholeNumberFrom(MINIMUM_REPEAT, block.repeat)
      ? []
      : [issue('routines.invalidRepeat', path)]),
    ...(block.children.length > 0 ? [] : [issue('routines.emptyBlock', path)]),
  ];
}

function setIssues(step: ExerciseStep, set: ExerciseSet, setIndex: number, path: NodePath): Issues {
  const { reps, duration } = set.target;
  const missingDuration = step.mode === 'timed' && !isPositive(duration);
  const invalidReps = reps !== undefined && !isWholeNumberFrom(MINIMUM_REPS, reps);
  return [
    ...(missingDuration ? [issue('routines.missingDuration', path, { setIndex })] : []),
    ...(invalidReps ? [issue('routines.invalidReps', path, { setIndex })] : []),
  ];
}

function exerciseStepIssues(step: ExerciseStep, path: NodePath): Issues {
  return step.sets.length === 0
    ? [issue('routines.noSets', path)]
    : step.sets.flatMap((set, setIndex) => setIssues(step, set, setIndex, path));
}

function restStepIssues(rest: RestStep, path: NodePath): Issues {
  return isPositive(rest.duration) ? [] : [issue('routines.zeroRest', path)];
}

/** Rules per node kind; the exhaustive switch makes a new node kind a compile error here. */
function nodeIssues({ node, path }: LocatedNode): Issues {
  switch (node.kind) {
    case 'block':
      return blockIssues(node, path);
    case 'exercise':
      return exerciseStepIssues(node, path);
    case 'rest':
      return restStepIssues(node, path);
  }
}

function duplicateIdIssues(nodes: readonly LocatedNode[]): Issues {
  const firstPathById = new Map<string, NodePath>();
  return nodes.flatMap(({ node, path }) => {
    const firstPath = firstPathById.get(node.id);
    if (firstPath !== undefined) {
      return [issue('routines.duplicateNodeId', path, { id: node.id, firstPath })];
    }
    firstPathById.set(node.id, path);
    return [];
  });
}

function nameIssues(routine: Routine): Issues {
  return routine.name.trim().length > 0 ? [] : [issue('routines.emptyName', [])];
}

function isValidated(routine: Routine, issues: Issues): routine is ValidatedRoutine {
  return issues.length === 0;
}

/**
 * Checks a routine (possibly a draft) before it can be played (S0-22, sprint-0 decision #4).
 * Pure; never throws. Returns every problem, each with the path of the node that caused it, so
 * the editor can highlight all of them at once.
 */
export function validateRoutine(
  routine: Routine,
): Result<ValidatedRoutine, RoutineValidationError> {
  const nodes = locateNodes(routine.root);
  const issues = [
    ...nameIssues(routine),
    ...nodes.flatMap(nodeIssues),
    ...duplicateIdIssues(nodes),
  ];
  if (isValidated(routine, issues)) {
    return ok(routine);
  }
  const message = `The routine has ${issues.length} problem(s) to fix before it can be started.`;
  return err(Object.freeze({ ...domainError('routines.invalidRoutine', message), issues }));
}
