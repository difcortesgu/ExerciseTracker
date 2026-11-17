import type { PickedPhoto } from '@modules/exercises/application/photo-ports';
import { aCustomPhoto } from '@test/builders/exercise.builder';
import { describePhotoStoreContract } from '@test/contracts/exercises/photo-store.contract';
import { SequentialIdGenerator } from '@test/fakes/sequential-id-generator';
import { memoryFileSystem } from '@test/support/in-memory-expo-file-system';
import { imageManipulator, type ImageSize } from '@test/support/in-memory-image-manipulator';

import { ExpoPhotoStore } from './expo-photo-store';

// Native module boundaries: the device file system and the native image decoder/encoder.
jest.mock('expo-file-system', () =>
  jest.requireActual<typeof import('@test/support/in-memory-expo-file-system')>(
    '@test/support/in-memory-expo-file-system',
  ),
);
jest.mock('expo-image-manipulator', () =>
  jest.requireActual<typeof import('@test/support/in-memory-image-manipulator')>(
    '@test/support/in-memory-image-manipulator',
  ),
);

const PHOTOS_URI = 'file:///data/files/exercise-photos';
const CAMERA_SIZE: ImageSize = { width: 4000, height: 3000 };

let picks = 0;

function givenPickedPhoto(size: ImageSize = CAMERA_SIZE): PickedPhoto {
  picks += 1;
  const uri = `file:///data/cache/ImagePicker/IMG_${picks}.jpg`;
  imageManipulator.givenImage(uri, size);
  return { uri, ...size };
}

const createStore = () => new ExpoPhotoStore({ idGenerator: new SequentialIdGenerator('photo') });

const storedFiles = () =>
  [...memoryFileSystem.files.keys()].filter((uri) => uri.startsWith(`${PHOTOS_URI}/`));

const resizes = () =>
  imageManipulator.operations.filter((operation) => operation.kind === 'resize');

beforeEach(() => {
  memoryFileSystem.reset();
  imageManipulator.reset();
});

describePhotoStoreContract('ExpoPhotoStore', () => ({
  store: createStore(),
  givenPickedPhoto,
  deleteOriginal: (photo) => {
    memoryFileSystem.files.delete(photo.uri);
  },
  givenImportFails: () => imageManipulator.givenSaveFails(new Error('No space left on device')),
  givenStorageFails: () => {
    memoryFileSystem.failingLists = true;
    memoryFileSystem.failingDeletes = true;
  },
}));

describe('ExpoPhotoStore', () => {
  it('stores a JPEG at quality 0.8 under a new id in the photo folder, keeping the original', async () => {
    const original = givenPickedPhoto();

    const imported = await createStore().importPhoto(original);

    expect(imported).toEqual({ ok: true, value: 'photo-1.jpg' });
    expect(imageManipulator.operations).toContainEqual({
      kind: 'save',
      options: { format: 'jpeg', compress: 0.8 },
    });
    expect(storedFiles()).toEqual([`${PHOTOS_URI}/photo-1.jpg`]);
    expect(memoryFileSystem.files.has(original.uri)).toBe(true);
    expect([...memoryFileSystem.files.keys()]).toHaveLength(2);
  });

  it.each([
    ['a landscape photo by its width', { width: 4000, height: 3000 }, { width: 1600 }],
    ['a portrait photo by its height', { width: 3000, height: 4000 }, { height: 1600 }],
    ['a square photo', { width: 2000, height: 2000 }, { width: 1600 }],
  ])('downscales %s to 1 600 px', async (_case, size, expectedResize) => {
    await createStore().importPhoto(givenPickedPhoto(size));

    expect(resizes()).toEqual([{ kind: 'resize', size: expectedResize }]);
  });

  it.each([
    ['smaller', { width: 1200, height: 800 }],
    ['exactly at the limit', { width: 1600, height: 900 }],
  ])('never upscales a photo that is %s', async (_case, size) => {
    await createStore().importPhoto(givenPickedPhoto(size));

    expect(resizes()).toEqual([]);
  });

  it('leaves nothing behind when the copy cannot be moved into place (storage full)', async () => {
    const original = givenPickedPhoto();
    memoryFileSystem.failingMoves = true;

    const result = await createStore().importPhoto(original);

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'exercises.photoImportFailed', details: { cause: expect.any(String) } },
    });
    expect([...memoryFileSystem.files.keys()]).toEqual([original.uri]);
  });

  it('fails when the original is gone before it could be read', async () => {
    const original = givenPickedPhoto();
    memoryFileSystem.files.delete(original.uri);

    const result = await createStore().importPhoto(original);

    expect(result).toMatchObject({ ok: false, error: { code: 'exercises.photoImportFailed' } });
    expect(memoryFileSystem.files.size).toBe(0);
  });

  it('refuses an id that does not make a valid photo file name, before touching the image', async () => {
    const store = new ExpoPhotoStore({ idGenerator: { next: () => 'not a file name' } });

    const result = await store.importPhoto(givenPickedPhoto());

    expect(result).toMatchObject({ ok: false, error: { code: 'exercises.photoImportFailed' } });
    expect(imageManipulator.operations).toEqual([]);
  });

  it('never overwrites or deletes an existing photo when an id repeats', async () => {
    const store = new ExpoPhotoStore({ idGenerator: { next: () => 'same' } });
    await store.importPhoto(givenPickedPhoto());

    const second = await store.importPhoto(givenPickedPhoto());

    expect(second).toMatchObject({ ok: false, error: { code: 'exercises.photoImportFailed' } });
    expect(storedFiles()).toEqual([`${PHOTOS_URI}/same.jpg`]);
    expect(
      [...memoryFileSystem.files.keys()].filter((uri) => uri.includes('ImageManipulator')),
    ).toEqual([]);
  });

  it('serves stored photos by their file URI', async () => {
    const store = createStore();
    const imported = await store.importPhoto(givenPickedPhoto());

    expect(imported.ok && (await store.localUri(imported.value))).toBe(`${PHOTOS_URI}/photo-1.jpg`);
  });

  it('lists only photo files, ignoring foreign files and folders', async () => {
    const store = createStore();
    await store.importPhoto(givenPickedPhoto());
    memoryFileSystem.files.set(`${PHOTOS_URI}/notes.txt`, 1);
    memoryFileSystem.directories.add(`${PHOTOS_URI}/folder.jpg`);

    expect(await store.listPhotos()).toEqual({
      ok: true,
      value: [aCustomPhoto('photo-1.jpg').fileName],
    });
  });

  it('reports why deleting failed', async () => {
    const store = createStore();
    const imported = await store.importPhoto(givenPickedPhoto());
    if (!imported.ok) throw new Error('import failed');
    memoryFileSystem.failingDeletes = true;

    expect(await store.deletePhotos([imported.value])).toMatchObject({
      ok: false,
      error: {
        code: 'exercises.photoStorageFailed',
        details: { cause: expect.stringContaining('Cannot delete') },
      },
    });
  });
});
