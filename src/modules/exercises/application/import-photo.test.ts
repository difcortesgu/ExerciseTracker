import { aPhotoView } from '@test/builders/exercise-dtos.builder';
import { FakePhotoPicker } from '@test/fakes/fake-photo-picker';
import { FakePhotoStore } from '@test/fakes/fake-photo-store';
import { RecordingLogger } from '@test/fakes/recording-logger';
import { unwrap, unwrapErr } from '@test/support/unwrap';

import { createImportPhoto } from './import-photo';
import type { PhotoStore } from './photo-ports';

function setUp(photoStore: PhotoStore = new FakePhotoStore()) {
  const picker = new FakePhotoPicker();
  const logger = new RecordingLogger();
  const importPhoto = createImportPhoto({ picker, photoStore, logger });
  return { picker, photoStore, logger, importPhoto };
}

describe('createImportPhoto (S1-22)', () => {
  it.each(['camera', 'library'] as const)(
    'stores an app-owned copy of a photo from the %s and returns it displayable',
    async (source) => {
      const { importPhoto, picker } = setUp();

      expect(unwrap(await importPhoto(source))).toEqual(aPhotoView('photo-1.jpg'));
      expect(picker.requestedSources).toEqual([source]);
    },
  );

  it('passes the picked photo to the store (never stores the picker URI)', async () => {
    const photoStore = new FakePhotoStore();
    const { importPhoto, picker } = setUp(photoStore);
    const photo = { uri: 'file:///picker/x.jpg', width: 10, height: 20 };
    picker.respondWith(photo);

    const view = unwrap(await importPhoto('library'));

    expect(photoStore.imported).toEqual([photo]);
    expect(view?.uri).not.toBe(photo.uri);
  });

  it('returns ok(null) and stores nothing when the user cancels', async () => {
    const photoStore = new FakePhotoStore();
    const { importPhoto, picker } = setUp(photoStore);
    picker.cancel();

    expect(unwrap(await importPhoto('camera'))).toBeNull();
    expect(photoStore.imported).toEqual([]);
  });

  it('returns a denied permission without logging it (the user chose so)', async () => {
    const { importPhoto, picker, logger } = setUp();
    picker.denyPermission('camera');

    expect(unwrapErr(await importPhoto('camera')).code).toBe('exercises.photoPermissionDenied');
    expect(logger.entries).toHaveLength(0);
  });

  it('returns and logs a picker failure', async () => {
    const { importPhoto, picker, logger } = setUp();
    picker.fail();

    expect(unwrapErr(await importPhoto('library')).code).toBe('exercises.photoPickerFailed');
    expect(logger.entriesAt('warn')).toHaveLength(1);
  });

  it('returns and logs a failed copy', async () => {
    const photoStore = new FakePhotoStore();
    photoStore.failImports();
    const { importPhoto, logger } = setUp(photoStore);

    expect(unwrapErr(await importPhoto('library')).code).toBe('exercises.photoImportFailed');
    expect(logger.entriesAt('warn')).toHaveLength(1);
  });

  it('reports exercises.photoImportFailed when the stored copy cannot be found afterwards', async () => {
    const fake = new FakePhotoStore();
    const photoStore: PhotoStore = {
      importPhoto: (photo) => fake.importPhoto(photo),
      localUri: () => Promise.resolve(null),
      deletePhotos: (fileNames) => fake.deletePhotos(fileNames),
      listPhotos: () => fake.listPhotos(),
    };
    const { importPhoto } = setUp(photoStore);

    expect(unwrapErr(await importPhoto('library')).code).toBe('exercises.photoImportFailed');
  });
});
