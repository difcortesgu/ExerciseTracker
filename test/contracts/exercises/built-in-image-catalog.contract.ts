import { aBuiltInExercise, aBuiltInImage, aCustomExercise } from '../../builders/exercise.builder';
import { defineContract } from '../contract-harness';

import {
  aSeedPlan,
  STORAGE_FAILURE,
  saveCustoms,
  seedBuiltIns,
  type ExerciseStoreFixture,
} from './exercise-store-fixture';

/** Contract of `BuiltInImageCatalog` (S1-28). */
export const describeBuiltInImageCatalogContract = defineContract<ExerciseStoreFixture>(
  'BuiltInImageCatalog',
  (store) => {
    it('lists nothing in an empty store', async () => {
      expect(await store().catalog.listActiveBuiltInImages()).toEqual({ ok: true, value: [] });
    });

    it('lists every image of active built-ins once, ordered by path', async () => {
      const squat = aBuiltInExercise().withId('b-1').named('Squat').build();
      const curl = aBuiltInExercise().withId('b-2').named('Curl').build();
      const shared = aBuiltInExercise()
        .withId('b-3')
        .named('Curl Variant')
        .with({ images: [aBuiltInImage('Curl/0.jpg')] })
        .build();
      const gone = aBuiltInExercise().withId('b-4').named('Gone').build();
      await seedBuiltIns(store(), [squat, curl, shared, gone]);
      await store().library.applySeed(aSeedPlan({ seedVersion: 2, archive: [gone.id] }));
      await saveCustoms(store(), aCustomExercise().withPhotos('mine.jpg').build());

      const listed = await store().catalog.listActiveBuiltInImages();

      expect(listed).toEqual({
        ok: true,
        value: [...curl.images, ...squat.images],
      });
    });

    it('returns exercises.storageFailed when storage fails', async () => {
      store().breakStorage();

      expect(await store().catalog.listActiveBuiltInImages()).toMatchObject(STORAGE_FAILURE);
    });
  },
);
