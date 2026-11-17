import { aCustomExercise, aVocabularyValue } from '../../builders/exercise.builder';
import { defineContract } from '../contract-harness';

import { STORAGE_FAILURE, type ExerciseStoreFixture } from './exercise-store-fixture';

/** Contract of `ExerciseWriter` (S1-19 to S1-21, S1-29). */
export const describeExerciseWriterContract = defineContract<ExerciseStoreFixture>(
  'ExerciseWriter',
  (store) => {
    it('stores a new custom exercise', async () => {
      const custom = aCustomExercise().withId('c-1').build();

      expect(await store().writer.saveCustom(custom, [])).toEqual({ ok: true, value: undefined });
      expect(await store().reader.findById(custom.id)).toEqual({ ok: true, value: custom });
    });

    it('replaces the stored exercise with the same id (edit, archive)', async () => {
      const original = aCustomExercise().withId('c-1').withPhotos('a.jpg').build();
      const edited = aCustomExercise().withId('c-1').named('Renamed').archived().build();
      await store().writer.saveCustom(original, []);

      await store().writer.saveCustom(edited, []);

      expect(await store().reader.findById(original.id, { includeArchived: true })).toEqual({
        ok: true,
        value: edited,
      });
    });

    it('stores the new user-defined values together with the exercise', async () => {
      const sandbag = aVocabularyValue().labelled('Sandbag').custom().build();
      const core = aVocabularyValue().ofKind('category').labelled('Core').custom().build();

      await store().writer.saveCustom(aCustomExercise().withId('c-1').build(), [sandbag, core]);

      const values = await store().vocabularyReader.listValues();
      expect(values.ok && values.value).toEqual(expect.arrayContaining([sandbag, core]));
      expect(values.ok && values.value).toHaveLength(2);
    });

    it('ignores a value that already exists with the same kind, key and origin', async () => {
      const sandbag = aVocabularyValue().labelled('Sandbag').custom().build();
      await store().writer.saveCustom(aCustomExercise().withId('c-1').build(), [sandbag]);

      const second = await store().writer.saveCustom(aCustomExercise().withId('c-2').build(), [
        aVocabularyValue().labelled('SANDBAG').custom().build(),
      ]);

      expect(second.ok).toBe(true);
      expect(await store().vocabularyReader.listValues()).toEqual({ ok: true, value: [sandbag] });
    });

    it('returns exercises.storageFailed and stores nothing when storage fails', async () => {
      store().breakStorage();

      expect(await store().writer.saveCustom(aCustomExercise().build(), [])).toMatchObject(
        STORAGE_FAILURE,
      );
    });
  },
);
