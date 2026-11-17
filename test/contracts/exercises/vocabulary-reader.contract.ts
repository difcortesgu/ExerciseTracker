import { aCustomExercise, aVocabularyValue } from '../../builders/exercise.builder';
import { defineContract } from '../contract-harness';

import {
  aSeedPlan,
  STORAGE_FAILURE,
  seedBuiltIns,
  type ExerciseStoreFixture,
} from './exercise-store-fixture';

const byIdentity = (first: {
  readonly kind: string;
  readonly key: string;
  readonly origin: string;
}) => `${first.kind}|${first.key}|${first.origin}`;

/** Contract of `VocabularyReader` (S1-29): unmerged values; own values survive re-seeding. */
export const describeVocabularyReaderContract = defineContract<ExerciseStoreFixture>(
  'VocabularyReader',
  (store) => {
    it('lists nothing in an empty store', async () => {
      expect(await store().vocabularyReader.listValues()).toEqual({ ok: true, value: [] });
    });

    it('lists built-in and user-defined values unmerged (a key once per origin)', async () => {
      const builtInBarbell = aVocabularyValue().labelled('Barbell').build();
      const builtInSandbag = aVocabularyValue().labelled('Sandbag').build();
      const ownSandbag = aVocabularyValue().labelled('sandbag').custom().build();
      await store().writer.saveCustom(aCustomExercise().build(), [ownSandbag]);
      await seedBuiltIns(store(), [], [builtInBarbell, builtInSandbag]);

      const values = await store().vocabularyReader.listValues();

      expect(
        values.ok && [...values.value].sort((a, b) => (byIdentity(a) < byIdentity(b) ? -1 : 1)),
      ).toEqual([builtInBarbell, builtInSandbag, ownSandbag]);
    });

    it('keeps user-defined values and old built-in values across re-seeds', async () => {
      const own = aVocabularyValue().ofKind('muscle').labelled('Serratus').custom().build();
      const oldBuiltIn = aVocabularyValue().labelled('Bands').build();
      await store().writer.saveCustom(aCustomExercise().build(), [own]);
      await seedBuiltIns(store(), [], [oldBuiltIn]);

      await store().library.applySeed(
        aSeedPlan({ seedVersion: 2, vocabulary: [aVocabularyValue().labelled('Cable').build()] }),
      );

      const values = await store().vocabularyReader.listValues();
      expect(values.ok && values.value).toEqual(
        expect.arrayContaining([own, oldBuiltIn, aVocabularyValue().labelled('Cable').build()]),
      );
    });

    it('updates the label of a built-in value seeded again', async () => {
      await seedBuiltIns(store(), [], [aVocabularyValue().labelled('E-z bar').build()]);

      await store().library.applySeed(
        aSeedPlan({ seedVersion: 2, vocabulary: [aVocabularyValue().labelled('E-Z bar').build()] }),
      );

      expect(await store().vocabularyReader.listValues()).toEqual({
        ok: true,
        value: [aVocabularyValue().labelled('E-Z bar').build()],
      });
    });

    it('returns exercises.storageFailed when storage fails', async () => {
      store().breakStorage();

      expect(await store().vocabularyReader.listValues()).toMatchObject(STORAGE_FAILURE);
    });
  },
);
