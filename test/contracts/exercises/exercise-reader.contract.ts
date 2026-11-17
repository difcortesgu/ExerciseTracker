import { summariseExercise } from '@modules/exercises/domain/exercise-summary';

import {
  aBuiltInExercise,
  aCustomExercise,
  vocabularyKeyOf,
} from '../../builders/exercise.builder';
import { defineContract } from '../contract-harness';

import {
  aSeedPlan,
  STORAGE_FAILURE,
  saveCustoms,
  seedBuiltIns,
  type ExerciseStoreFixture,
} from './exercise-store-fixture';

const byId = (first: { readonly id: string }, second: { readonly id: string }) =>
  first.id < second.id ? -1 : 1;

/** Contract of `ExerciseReader` (S1-14, S1-19 to S1-22). */
export const describeExerciseReaderContract = defineContract<ExerciseStoreFixture>(
  'ExerciseReader',
  (store) => {
    it('lists nothing in an empty store', async () => {
      expect(await store().reader.listActiveSummaries()).toEqual({ ok: true, value: [] });
    });

    it('lists every active built-in and custom exercise as a summary', async () => {
      const builtIn = aBuiltInExercise().withId('b-1').build();
      const custom = aCustomExercise().withId('c-1').withPhotos('p1.jpg', 'p2.jpg').build();
      await seedBuiltIns(store(), [builtIn]);
      await saveCustoms(store(), custom);

      const listed = await store().reader.listActiveSummaries();

      expect(listed.ok && [...listed.value].sort(byId)).toEqual([
        summariseExercise(builtIn),
        summariseExercise(custom),
      ]);
    });

    it('never lists archived exercises', async () => {
      const removed = aBuiltInExercise().withId('b-1').named('Old').build();
      await seedBuiltIns(store(), [removed]);
      await store().library.applySeed(aSeedPlan({ seedVersion: 2, archive: [removed.id] }));
      await saveCustoms(store(), aCustomExercise().withId('c-1').archived().build());

      expect(await store().reader.listActiveSummaries()).toEqual({ ok: true, value: [] });
    });

    it('round-trips every field of a built-in exactly', async () => {
      const builtIn = aBuiltInExercise()
        .withId('b-1')
        .with({ force: null, mechanic: null, equipment: null, level: 'expert' })
        .build();
      await seedBuiltIns(store(), [builtIn]);

      expect(await store().reader.findById(builtIn.id)).toEqual({ ok: true, value: builtIn });
    });

    it('round-trips every field of a custom exercise exactly, lists in order', async () => {
      const custom = aCustomExercise()
        .withId('c-1')
        .withPhotos('z.jpg', 'a.jpg')
        .with({
          name: 'Préss Fráncés',
          primaryMuscles: [vocabularyKeyOf('Triceps'), vocabularyKeyOf('Chest')],
          secondaryMuscles: [],
          instructions: ['Third', 'First', 'Second'],
          trackedMetrics: ['reps', 'time', 'rpe'],
        })
        .build();
      await saveCustoms(store(), custom);

      expect(await store().reader.findById(custom.id)).toEqual({ ok: true, value: custom });
    });

    it('finds nothing for an unknown id', async () => {
      expect(await store().reader.findById(aCustomExercise().withId('missing').build().id)).toEqual(
        { ok: true, value: null },
      );
    });

    it('hides an archived exercise unless archived ones are included', async () => {
      const archived = aCustomExercise().withId('c-1').archived().build();
      await saveCustoms(store(), archived);

      expect(await store().reader.findById(archived.id)).toEqual({ ok: true, value: null });
      expect(await store().reader.findById(archived.id, { includeArchived: true })).toEqual({
        ok: true,
        value: archived,
      });
      expect(await store().reader.findById(archived.id, { includeArchived: false })).toEqual({
        ok: true,
        value: null,
      });
    });

    describe('findActiveByNameKey', () => {
      it('finds an active built-in or custom exercise by the comparison key of its name', async () => {
        const builtIn = aBuiltInExercise().withId('b-1').named('Barbell Squat').build();
        const custom = aCustomExercise().withId('c-1').named('My Goblet Squat').build();
        await seedBuiltIns(store(), [builtIn]);
        await saveCustoms(store(), custom);

        expect(
          await store().reader.findActiveByNameKey(vocabularyKeyOf(' bárbell  SQUAT')),
        ).toEqual({ ok: true, value: summariseExercise(builtIn) });
        expect(
          await store().reader.findActiveByNameKey(vocabularyKeyOf('my goblet squat')),
        ).toEqual({ ok: true, value: summariseExercise(custom) });
      });

      it('finds nothing for another name, an archived exercise, or the excluded one', async () => {
        const custom = aCustomExercise().withId('c-1').named('Goblet Squat').build();
        await saveCustoms(
          store(),
          custom,
          aCustomExercise().withId('c-2').named('Old').archived().build(),
        );

        expect(await store().reader.findActiveByNameKey(vocabularyKeyOf('Squat'))).toEqual({
          ok: true,
          value: null,
        });
        expect(await store().reader.findActiveByNameKey(vocabularyKeyOf('old'))).toEqual({
          ok: true,
          value: null,
        });
        expect(
          await store().reader.findActiveByNameKey(vocabularyKeyOf('goblet squat'), custom.id),
        ).toEqual({ ok: true, value: null });
      });

      it('still finds another exercise with that name when one is excluded', async () => {
        const builtIn = aBuiltInExercise().withId('b-1').named('Plank').build();
        const custom = aCustomExercise().withId('c-1').named('plank').build();
        await seedBuiltIns(store(), [builtIn]);
        await saveCustoms(store(), custom);

        expect(
          await store().reader.findActiveByNameKey(vocabularyKeyOf('Plank'), custom.id),
        ).toEqual({ ok: true, value: summariseExercise(builtIn) });
      });
    });

    it('lists the photo files of active custom exercises only', async () => {
      await saveCustoms(
        store(),
        aCustomExercise().withId('c-1').withPhotos('a.jpg', 'b.jpg').build(),
        aCustomExercise().withId('c-2').withPhotos('c.jpg').build(),
        aCustomExercise().withId('c-3').withPhotos('gone.jpg').archived().build(),
      );

      const listed = await store().reader.listActivePhotoFileNames();

      expect(listed).toEqual({ ok: true, value: new Set(['a.jpg', 'b.jpg', 'c.jpg']) });
    });

    it('returns exercises.storageFailed from every method when storage fails', async () => {
      const id = aCustomExercise().withId('c-1').build().id;
      store().breakStorage();

      expect(await store().reader.listActiveSummaries()).toMatchObject(STORAGE_FAILURE);
      expect(await store().reader.findById(id)).toMatchObject(STORAGE_FAILURE);
      expect(await store().reader.findActiveByNameKey(vocabularyKeyOf('x'))).toMatchObject(
        STORAGE_FAILURE,
      );
      expect(await store().reader.listActivePhotoFileNames()).toMatchObject(STORAGE_FAILURE);
    });
  },
);
