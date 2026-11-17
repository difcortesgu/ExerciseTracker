import type { PhotoStore, PickedPhoto } from '@modules/exercises/application/photo-ports';

import { aCustomPhoto } from '../../builders/exercise.builder';
import { defineContract } from '../contract-harness';

/** A photo store plus a way to arrange picked photos and storage problems. */
export interface PhotoStoreFixture {
  readonly store: PhotoStore;
  /** A photo the picker just returned (its temporary file exists). */
  givenPickedPhoto(size?: { width: number; height: number }): PickedPhoto;
  /** The original disappears (e.g. deleted from the gallery). */
  deleteOriginal(photo: PickedPhoto): void;
  /** Downscaling/copying fails (e.g. storage full). */
  givenImportFails(): void;
  /** Listing and deleting stored photos fails. */
  givenStorageFails(): void;
}

/** Contract of `PhotoStore` (S1-22). */
export const describePhotoStoreContract = defineContract<PhotoStoreFixture>(
  'PhotoStore',
  (fixture) => {
    it('stores nothing at first', async () => {
      expect(await fixture().store.listPhotos()).toEqual({ ok: true, value: [] });
    });

    it('imports a copy under a new name and serves it by file URI', async () => {
      const imported = await fixture().store.importPhoto(fixture().givenPickedPhoto());

      expect(imported).toEqual({
        ok: true,
        value: expect.stringMatching(/^[A-Za-z0-9_-]+\.jpg$/) as unknown,
      });
      const fileName = imported.ok ? imported.value : aCustomPhoto('x.jpg').fileName;
      expect(await fixture().store.localUri(fileName)).toMatch(/^file:\/\/.+\.jpg$/);
      expect(await fixture().store.listPhotos()).toEqual({ ok: true, value: [fileName] });
    });

    it('gives every import its own name', async () => {
      const first = await fixture().store.importPhoto(fixture().givenPickedPhoto());
      const second = await fixture().store.importPhoto(fixture().givenPickedPhoto());

      expect(first.ok && second.ok && first.value !== second.value).toBe(true);
    });

    it('keeps the copy when the original is deleted', async () => {
      const original = fixture().givenPickedPhoto();
      const imported = await fixture().store.importPhoto(original);

      fixture().deleteOriginal(original);

      expect(imported.ok && (await fixture().store.localUri(imported.value))).toEqual(
        expect.stringMatching(/^file:\/\//),
      );
    });

    it('leaves nothing behind when an import fails', async () => {
      fixture().givenImportFails();

      const result = await fixture().store.importPhoto(fixture().givenPickedPhoto());

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: 'exercises.photoImportFailed',
          details: { cause: expect.any(String) as unknown },
        },
      });
      expect(await fixture().store.listPhotos()).toEqual({ ok: true, value: [] });
    });

    it('has no URI for a photo it does not store', async () => {
      expect(await fixture().store.localUri(aCustomPhoto('missing.jpg').fileName)).toBeNull();
    });

    it('deletes photos, ignoring ones that are already gone', async () => {
      const kept = await fixture().store.importPhoto(fixture().givenPickedPhoto());
      const removed = await fixture().store.importPhoto(fixture().givenPickedPhoto());
      if (!kept.ok || !removed.ok) throw new Error('import failed');

      const deleted = await fixture().store.deletePhotos([
        removed.value,
        aCustomPhoto('never-existed.jpg').fileName,
      ]);

      expect(deleted).toEqual({ ok: true, value: undefined });
      expect(await fixture().store.localUri(removed.value)).toBeNull();
      expect(await fixture().store.listPhotos()).toEqual({ ok: true, value: [kept.value] });
    });

    it('returns exercises.photoStorageFailed when listing or deleting fails', async () => {
      const imported = await fixture().store.importPhoto(fixture().givenPickedPhoto());
      if (!imported.ok) throw new Error('import failed');
      fixture().givenStorageFails();

      const expected = { ok: false, error: { code: 'exercises.photoStorageFailed' } };
      expect(await fixture().store.listPhotos()).toMatchObject(expected);
      expect(await fixture().store.deletePhotos([imported.value])).toMatchObject(expected);
    });
  },
);
