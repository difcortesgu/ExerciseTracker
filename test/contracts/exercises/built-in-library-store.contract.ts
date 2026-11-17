import {
  aBuiltInExercise,
  aCustomExercise,
  aVocabularyValue,
} from '../../builders/exercise.builder';
import { defineContract } from '../contract-harness';

import {
  aSeedPlan,
  STORAGE_FAILURE,
  saveCustoms,
  type ExerciseStoreFixture,
} from './exercise-store-fixture';

const byId = (first: { readonly id: string }, second: { readonly id: string }) =>
  first.id < second.id ? -1 : 1;

/** Contract of `BuiltInLibraryStore` (S1-12): versioned, all-or-nothing, never touches custom data. */
export const describeBuiltInLibraryStoreContract = defineContract<ExerciseStoreFixture>(
  'BuiltInLibraryStore',
  (store) => {
    it('has no seed version and no built-ins in a fresh store', async () => {
      expect(await store().library.readSeedVersion()).toEqual({ ok: true, value: null });
      expect(await store().library.listBuiltIns()).toEqual({ ok: true, value: [] });
    });

    it('applies inserts and records the seed version', async () => {
      const squat = aBuiltInExercise().withId('b-1').build();

      expect(
        await store().library.applySeed(aSeedPlan({ seedVersion: 3, insert: [squat] })),
      ).toEqual({
        ok: true,
        value: undefined,
      });

      expect(await store().library.readSeedVersion()).toEqual({ ok: true, value: 3 });
      expect(await store().library.listBuiltIns()).toEqual({ ok: true, value: [squat] });
    });

    it('updates in place and archives, listing archived built-ins too', async () => {
      const squat = aBuiltInExercise().withId('b-1').build();
      const plank = aBuiltInExercise().withId('b-2').named('Plank').build();
      await store().library.applySeed(aSeedPlan({ insert: [squat, plank] }));
      const renamed = { ...squat, name: 'Back Squat' };

      await store().library.applySeed(
        aSeedPlan({ seedVersion: 2, update: [renamed], archive: [plank.id] }),
      );

      const listed = await store().library.listBuiltIns();
      expect(listed.ok && [...listed.value].sort(byId)).toEqual([
        renamed,
        { ...plank, archived: true },
      ]);
      expect(await store().library.readSeedVersion()).toEqual({ ok: true, value: 2 });
    });

    it('never lists, changes or removes custom exercises or user-defined values', async () => {
      const custom = aCustomExercise().withId('c-1').withPhotos('a.jpg').build();
      const own = aVocabularyValue().labelled('Sandbag').custom().build();
      await store().writer.saveCustom(custom, [own]);

      await store().library.applySeed(
        aSeedPlan({
          insert: [aBuiltInExercise().withId('b-1').named(custom.name).build()],
          archive: [custom.id],
          vocabulary: [aVocabularyValue().labelled('Sandbag').build()],
        }),
      );

      expect(await store().library.listBuiltIns()).toMatchObject({
        ok: true,
        value: [{ id: 'b-1' }],
      });
      expect(await store().reader.findById(custom.id)).toEqual({ ok: true, value: custom });
      const values = await store().vocabularyReader.listValues();
      expect(values.ok && values.value).toContainEqual(own);
    });

    it('writes nothing when a plan cannot be applied completely', async () => {
      const squat = aBuiltInExercise().withId('b-1').build();
      await store().library.applySeed(aSeedPlan({ insert: [squat] }));
      await saveCustoms(store(), aCustomExercise().withId('c-1').build());

      const broken = aSeedPlan({
        seedVersion: 2,
        insert: [
          aBuiltInExercise().withId('b-2').named('New').build(),
          { ...squat, name: 'Clash' },
        ],
        vocabulary: [aVocabularyValue().labelled('Cable').build()],
      });

      expect(await store().library.applySeed(broken)).toMatchObject(STORAGE_FAILURE);
      expect(await store().library.readSeedVersion()).toEqual({ ok: true, value: 1 });
      expect(await store().library.listBuiltIns()).toEqual({ ok: true, value: [squat] });
      expect(await store().vocabularyReader.listValues()).toEqual({ ok: true, value: [] });
    });

    it('returns exercises.storageFailed from every method when storage fails', async () => {
      store().breakStorage();

      expect(await store().library.readSeedVersion()).toMatchObject(STORAGE_FAILURE);
      expect(await store().library.listBuiltIns()).toMatchObject(STORAGE_FAILURE);
      expect(await store().library.applySeed(aSeedPlan())).toMatchObject(STORAGE_FAILURE);
    });
  },
);
