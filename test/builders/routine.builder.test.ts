import { durationEquals, durationFromSeconds } from '@shared/domain/duration';
import { distanceIn } from '@shared/domain/distance';
import { weightIn } from '@shared/domain/weight';

import { unwrap } from '../support/unwrap';

import { aBlock, anExerciseStep, aRestStep, aRoutine, aSet } from './routine.builder';

const seconds = (value: number) => unwrap(durationFromSeconds(value));

describe('routine builders', () => {
  describe('aRoutine', () => {
    it('builds a routine with sensible defaults and a non-empty root block', () => {
      const routine = aRoutine().build();

      expect(routine).toMatchObject({ name: 'Full body', notes: '' });
      expect(routine.root.kind).toBe('block');
      expect(routine.root.children).toHaveLength(1);
    });

    it('overrides only the fields a test cares about', () => {
      const routine = aRoutine()
        .withId('routine-7')
        .named('Leg day')
        .withNotes('Go heavy')
        .with(aRestStep())
        .build();

      expect(routine).toMatchObject({ id: 'routine-7', name: 'Leg day', notes: 'Go heavy' });
      expect(routine.root.children.map((child) => child.kind)).toEqual(['rest']);
    });

    it('replaces the root block', () => {
      const routine = aRoutine().withRoot(aBlock().withId('root').repeat(2)).build();

      expect(routine.root).toMatchObject({ id: 'root', repeat: 2 });
    });
  });

  describe('aBlock', () => {
    it('defaults to one round with one exercise step and no rest between rounds', () => {
      const block = aBlock().build();

      expect(block).toMatchObject({ kind: 'block', label: '', repeat: 1 });
      expect(durationEquals(block.restBetweenRounds, seconds(0))).toBe(true);
      expect(block.children.map((child) => child.kind)).toEqual(['exercise']);
    });

    it('sets label, repeat, rest between rounds and children', () => {
      const block = aBlock()
        .label('Circuit')
        .repeat(3)
        .restBetweenRounds(90)
        .with(aRestStep(), aRestStep())
        .build();

      expect(block).toMatchObject({ label: 'Circuit', repeat: 3 });
      expect(durationEquals(block.restBetweenRounds, seconds(90))).toBe(true);
      expect(block.children).toHaveLength(2);
    });

    it('builds an empty block on request (for drafts and validation tests)', () => {
      expect(aBlock().withNoChildren().build().children).toEqual([]);
    });
  });

  describe('anExerciseStep', () => {
    it('defaults to a reps step with one set of 10 reps and 60 s rest', () => {
      const step = anExerciseStep().build();

      expect(step).toMatchObject({ kind: 'exercise', exerciseId: 'exercise-squat', mode: 'reps' });
      expect(step.sets).toHaveLength(1);
      expect(step.sets[0]?.target).toEqual({ reps: 10 });
      expect(step.sets[0]?.restAfter).toEqual(seconds(60));
    });

    it('gives a timed step a default set with a work duration', () => {
      const step = anExerciseStep().timed().build();

      expect(step.mode).toBe('timed');
      expect(step.sets[0]?.target.duration).toEqual(seconds(40));
    });

    it('sets the exercise and the sets', () => {
      const step = anExerciseStep()
        .forExercise('exercise-pushup')
        .withSets(aSet().reps(12), aSet().reps(10))
        .build();

      expect(step.exerciseId).toBe('exercise-pushup');
      expect(step.sets.map((set) => set.target.reps)).toEqual([12, 10]);
    });

    it('switches back to reps mode', () => {
      expect(anExerciseStep().timed().reps().build().mode).toBe('reps');
    });

    it('builds a step without sets on request', () => {
      expect(anExerciseStep().withNoSets().build().sets).toEqual([]);
    });
  });

  describe('aSet', () => {
    it('sets every target with unit value objects', () => {
      const set = aSet().reps(5).weight(225, 'lb').duration(30).distance(400, 'm').build();

      expect(set.target.reps).toBe(5);
      expect(set.target.weight && weightIn(set.target.weight, 'lb')).toBe(225);
      expect(set.target.duration).toEqual(seconds(30));
      expect(set.target.distance && distanceIn(set.target.distance, 'm')).toBe(400);
    });

    it('removes the reps target ("until done")', () => {
      expect(aSet().withoutReps().build().target).toEqual({});
    });

    it('sets the rest after the set', () => {
      expect(aSet().restAfter(120).build().restAfter).toEqual(seconds(120));
    });
  });

  describe('aRestStep', () => {
    it('defaults to 30 s and accepts another duration', () => {
      expect(aRestStep().build().duration).toEqual(seconds(30));
      expect(aRestStep().duration(45).build()).toMatchObject({ kind: 'rest' });
      expect(aRestStep().duration(45).build().duration).toEqual(seconds(45));
    });
  });

  describe('determinism and immutability', () => {
    it('assigns ids from a deterministic, unique sequence', () => {
      const routine = aRoutine().with(anExerciseStep(), aRestStep(), aBlock()).build();
      const ids = [routine.id, routine.root.id, ...routine.root.children.map((child) => child.id)];

      expect(new Set(ids).size).toBe(ids.length);
      ids.forEach((id) => expect(id).toMatch(/^[a-z]+-\d+$/));
    });

    it('returns a new builder from every method, leaving the original unchanged', () => {
      const base = aBlock().repeat(2);

      base.repeat(5);

      expect(base.build().repeat).toBe(2);
    });

    it('uses an explicit id when given (e.g. to create duplicates)', () => {
      expect(aRestStep().withId('same').build().id).toBe('same');
      expect(anExerciseStep().withId('same').build().id).toBe('same');
    });
  });
});
