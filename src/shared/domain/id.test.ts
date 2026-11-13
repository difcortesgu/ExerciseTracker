import * as fc from 'fast-check';

import { unwrap } from '@test/support/unwrap';

import { idFactory, type Id } from './id';
import { parseExerciseId, parseRoutineId, type ExerciseId, type RoutineId } from './ids';
import { isErr, isOk } from './result';

/** A module can declare its own id type without editing shared code (Open/Closed). */
type SampleId = Id<'SampleId'>;
const parseSampleId = idFactory('SampleId');

const acceptsRoutineId = (id: RoutineId): string => id;

describe('idFactory', () => {
  it('creates a branded id from a non-empty string', () => {
    const result = parseSampleId('sample-1');

    expect(isOk(result)).toBe(true);
    const id: SampleId = unwrap(result);
    expect(id).toBe('sample-1');
  });

  it.each(['', ' ', '\t\n  '])('rejects the empty or whitespace-only string %j', (raw) => {
    const result = parseSampleId(raw);

    expect(isErr(result)).toBe(true);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: 'shared.invalidId',
        message: expect.stringContaining('SampleId'),
        details: { idType: 'SampleId' },
      }),
    });
  });

  it('accepts any string with a non-whitespace character unchanged', () => {
    fc.assert(
      fc.property(
        fc.string().filter((raw) => raw.trim().length > 0),
        (raw) => {
          expect(unwrap(parseSampleId(raw))).toBe(raw);
        },
      ),
    );
  });
});

describe('shared ids', () => {
  it('creates exercise and routine ids through their factories', () => {
    expect(unwrap(parseExerciseId('exercise-1'))).toBe('exercise-1');
    expect(unwrap(parseRoutineId('routine-1'))).toBe('routine-1');
  });

  it('rejects an ExerciseId where a RoutineId is expected, at compile time', () => {
    const exerciseId: ExerciseId = unwrap(parseExerciseId('exercise-1'));
    const routineId: RoutineId = unwrap(parseRoutineId('routine-1'));

    // @ts-expect-error -- an ExerciseId is not a RoutineId
    expect(acceptsRoutineId(exerciseId)).toBe('exercise-1');
    // @ts-expect-error -- a raw string is not a RoutineId
    expect(acceptsRoutineId('routine-1')).toBe('routine-1');
    expect(acceptsRoutineId(routineId)).toBe('routine-1');
  });
});
