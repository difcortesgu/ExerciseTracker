import type {
  PhotoPicker,
  PhotoSource,
  PickedPhoto,
} from '@modules/exercises/application/photo-ports';

import { defineContract } from '../contract-harness';

/** A photo picker plus a way to arrange what the user (and Android) does next. */
export interface PhotoPickerFixture {
  readonly picker: PhotoPicker;
  givenPicked(photo: PickedPhoto): void;
  givenCancelled(): void;
  givenPermissionDenied(source: PhotoSource): void;
  givenPickerFails(): void;
}

const PHOTO: PickedPhoto = { uri: 'file:///picker/cache/IMG_0001.jpg', width: 4000, height: 3000 };
const SOURCES: readonly PhotoSource[] = ['camera', 'library'];

/** Contract of `PhotoPicker` (S1-22). */
export const describePhotoPickerContract = defineContract<PhotoPickerFixture>(
  'PhotoPicker',
  (fixture) => {
    it.each(SOURCES)('returns the photo picked from the %s', async (source) => {
      fixture().givenPicked(PHOTO);

      expect(await fixture().picker.pick(source)).toEqual({ ok: true, value: PHOTO });
    });

    it.each(SOURCES)('returns null when the user cancels the %s', async (source) => {
      fixture().givenCancelled();

      expect(await fixture().picker.pick(source)).toEqual({ ok: true, value: null });
    });

    it('reports a denied camera permission with its source', async () => {
      fixture().givenPermissionDenied('camera');

      expect(await fixture().picker.pick('camera')).toMatchObject({
        ok: false,
        error: { code: 'exercises.photoPermissionDenied', details: { source: 'camera' } },
      });
    });

    it('resolves (never rejects) with exercises.photoPickerFailed when the picker fails', async () => {
      fixture().givenPickerFails();

      expect(await fixture().picker.pick('library')).toMatchObject({
        ok: false,
        error: {
          code: 'exercises.photoPickerFailed',
          details: { cause: expect.any(String) as unknown },
        },
      });
    });
  },
);
