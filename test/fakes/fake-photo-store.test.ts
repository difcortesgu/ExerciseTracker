import { describePhotoStoreContract } from '@test/contracts/exercises/photo-store.contract';
import { aCustomPhoto } from '@test/builders/exercise.builder';

import { FakePhotoStore } from './fake-photo-store';

describePhotoStoreContract('FakePhotoStore', () => {
  const store = new FakePhotoStore();
  return {
    store,
    givenPickedPhoto: (size = { width: 4000, height: 3000 }) => store.pickedPhoto(size),
    deleteOriginal: (photo) => store.deleteOriginal(photo),
    givenImportFails: () => store.failImports(),
    givenStorageFails: () => store.failStorage(),
  };
});

describe('FakePhotoStore', () => {
  it('starts with arranged photos and records deletions', async () => {
    const photo = aCustomPhoto('a.jpg').fileName;
    const store = new FakePhotoStore([photo]);

    await store.deletePhotos([photo]);

    expect(store.deleted).toEqual([photo]);
    expect(await store.listPhotos()).toEqual({ ok: true, value: [] });
  });

  it('serves photos under the builders photo folder', async () => {
    const store = new FakePhotoStore([aCustomPhoto('a.jpg').fileName]);

    expect(await store.localUri(aCustomPhoto('a.jpg').fileName)).toBe(
      'file:///data/user/0/app/files/exercise-photos/a.jpg',
    );
  });
});
