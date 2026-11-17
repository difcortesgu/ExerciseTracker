import * as fc from 'fast-check';

import { SequentialIdGenerator } from '@test/fakes/sequential-id-generator';
import {
  aBuiltInExercise,
  aBuiltInImage,
  aVocabularyValue,
  exerciseIdOf,
} from '@test/builders/exercise.builder';

import { createBuiltInExercise, type BuiltInExercise, type BuiltInExerciseData } from './exercise';
import { planLibrarySeed } from './library-seed';

const idsFrom = (prefix: string) => {
  const generator = new SequentialIdGenerator(prefix);
  return () => exerciseIdOf(generator.next());
};

/** A stored built-in exactly as seeding stored it from `data`. */
const stored = (id: string, data: BuiltInExerciseData): BuiltInExercise =>
  createBuiltInExercise(exerciseIdOf(id), data);

const squat = aBuiltInExercise().named('Barbell Squat').buildData();
const deadlift = aBuiltInExercise().named('Deadlift').buildData();
const plank = aBuiltInExercise().named('Plank').buildData();
const vocabulary = [aVocabularyValue().labelled('Barbell').build()];

const plan = (existing: readonly BuiltInExercise[], seed: readonly BuiltInExerciseData[]) =>
  planLibrarySeed({ seedVersion: 2, existing, seed, vocabulary, newId: idsFrom('new') });

describe('planLibrarySeed (S1-12)', () => {
  it('inserts every seed exercise with a new id on a fresh install', () => {
    const result = plan([], [squat, deadlift]);

    expect(result.insert).toEqual([stored('new-1', squat), stored('new-2', deadlift)]);
    expect(result).toMatchObject({ seedVersion: 2, update: [], archive: [], vocabulary });
  });

  it('writes nothing for built-ins that did not change', () => {
    const result = plan([stored('s', squat), stored('d', deadlift)], [squat, deadlift]);

    expect(result).toMatchObject({ insert: [], update: [], archive: [] });
  });

  it('updates a changed built-in in place by its source key, keeping its id', () => {
    const renamed = {
      ...squat,
      name: 'Back Squat',
      images: [aBuiltInImage('Barbell_Squat/0.jpg', 1)],
    };

    const result = plan([stored('s', squat)], [renamed]);

    expect(result.update).toEqual([stored('s', renamed)]);
    expect(result.insert).toEqual([]);
  });

  it.each([
    ['instructions', { instructions: ['One step only.'] }],
    ['secondary muscles', { secondaryMuscles: [] }],
    ['level', { level: 'expert' as const }],
    ['force', { force: null }],
    ['mechanic', { mechanic: 'isolation' as const }],
    ['image size', { images: [aBuiltInImage('Barbell_Squat/0.jpg', 7)] }],
  ])('treats a change of the %s as a change', (_field, change) => {
    expect(plan([stored('s', squat)], [{ ...squat, ...change }]).update).toHaveLength(1);
  });

  it('re-derives the tracked metrics when the equipment changes', () => {
    const bodyOnly = { ...squat, equipment: aVocabularyValue().labelled('body only').build().key };

    expect(plan([stored('s', squat)], [bodyOnly]).update[0]?.trackedMetrics).toEqual(['reps']);
  });

  it('archives built-ins that are no longer in the seed, never deletes them', () => {
    const result = plan([stored('s', squat), stored('p', plank)], [squat]);

    expect(result.archive).toEqual(['p']);
  });

  it('does not archive again what is already archived', () => {
    const archivedPlank = { ...stored('p', plank), archived: true };

    expect(plan([archivedPlank], []).archive).toEqual([]);
  });

  it('un-archives a built-in that came back, with the same id', () => {
    const archivedPlank = { ...stored('p', plank), archived: true };

    expect(plan([archivedPlank], [plank]).update).toEqual([stored('p', plank)]);
  });

  it('returns a frozen plan', () => {
    const result = plan([], [squat]);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.insert)).toBe(true);
  });

  it('never changes an existing id and never drops a stored built-in', () => {
    const pool = ['A', 'B', 'C', 'D', 'E'].map((name) =>
      aBuiltInExercise().named(name).buildData(),
    );
    const subset = fc.subarray(pool);
    fc.assert(
      fc.property(subset, subset, fc.boolean(), (storedData, seed, rename) => {
        const existing = storedData.map((data, index) => stored(`old-${index}`, data));
        const changedSeed = seed.map((data) =>
          rename ? { ...data, name: `${data.name}!` } : data,
        );

        const result = plan(existing, changedSeed);

        const existingIds = new Set(existing.map(({ id }) => id));
        result.insert.forEach(({ id }) => expect(existingIds.has(id)).toBe(false));
        result.update.forEach(({ id, sourceKey }) =>
          expect(existing.find((e) => e.sourceKey === sourceKey)?.id).toBe(id),
        );
        existing.forEach(({ id, sourceKey }) => {
          const inSeed = changedSeed.some((data) => data.sourceKey === sourceKey);
          expect(result.archive.includes(id)).toBe(!inSeed);
        });
        expect(result.insert.length + result.update.length).toBeLessThanOrEqual(changedSeed.length);
      }),
    );
  });
});
