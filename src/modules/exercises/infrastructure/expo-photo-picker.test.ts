import { describePhotoPickerContract } from '@test/contracts/exercises/photo-picker.contract';
import { imagePicker } from '@test/support/in-memory-image-picker';

import { ExpoPhotoPicker } from './expo-photo-picker';

// Native module boundary: expo-image-picker opens the system camera and photo picker.
jest.mock('expo-image-picker', () =>
  jest.requireActual<typeof import('@test/support/in-memory-image-picker')>(
    '@test/support/in-memory-image-picker',
  ),
);

const PHOTO = { uri: 'file:///data/cache/ImagePicker/IMG_1.jpg', width: 4000, height: 3000 };
const PICKER_OPTIONS = { mediaTypes: ['images'], allowsEditing: false, quality: 1 };

beforeEach(() => {
  imagePicker.reset();
});

describePhotoPickerContract('ExpoPhotoPicker', () => ({
  picker: new ExpoPhotoPicker(),
  givenPicked: (photo) => imagePicker.givenPicked(photo),
  givenCancelled: () => imagePicker.givenCancelled(),
  givenPermissionDenied: (source) =>
    source === 'camera'
      ? imagePicker.givenCameraPermissionDenied()
      : imagePicker.givenLaunchPermissionRejected(),
  givenPickerFails: () => imagePicker.givenLaunchRejects(new Error('Activity lost')),
}));

describe('ExpoPhotoPicker', () => {
  it('asks for the camera permission, then opens the camera for one unedited full-quality image', async () => {
    imagePicker.givenPicked(PHOTO);

    await new ExpoPhotoPicker().pick('camera');

    expect(imagePicker.calls).toEqual([
      { method: 'requestCameraPermissionsAsync' },
      { method: 'launchCameraAsync', options: PICKER_OPTIONS },
    ]);
  });

  it('opens the photo library without asking for a permission (Android photo picker)', async () => {
    imagePicker.givenPicked(PHOTO);

    await new ExpoPhotoPicker().pick('library');

    expect(imagePicker.calls).toEqual([
      { method: 'launchImageLibraryAsync', options: PICKER_OPTIONS },
    ]);
  });

  it('does not open the camera when its permission is denied', async () => {
    imagePicker.givenCameraPermissionDenied();

    await new ExpoPhotoPicker().pick('camera');

    expect(imagePicker.calls).toEqual([{ method: 'requestCameraPermissionsAsync' }]);
  });

  it('maps a permission refused while launching the library to a denial of the library', async () => {
    imagePicker.givenLaunchPermissionRejected();

    expect(await new ExpoPhotoPicker().pick('library')).toMatchObject({
      ok: false,
      error: { code: 'exercises.photoPermissionDenied', details: { source: 'library' } },
    });
  });

  it('returns only the URI and size of the picked image', async () => {
    imagePicker.givenPicked(PHOTO);

    const picked = await new ExpoPhotoPicker().pick('library');

    expect(picked).toEqual({ ok: true, value: PHOTO });
    expect(picked.ok && Object.isFrozen(picked.value)).toBe(true);
  });

  it('fails when the picker reports success without an image', async () => {
    imagePicker.givenNoAssets();

    expect(await new ExpoPhotoPicker().pick('camera')).toMatchObject({
      ok: false,
      error: { code: 'exercises.photoPickerFailed', details: { cause: expect.any(String) } },
    });
  });

  it('fails (never rejects) when the permission request itself fails', async () => {
    imagePicker.givenPermissionRequestFails(new Error('No activity'));

    expect(await new ExpoPhotoPicker().pick('camera')).toMatchObject({
      ok: false,
      error: { code: 'exercises.photoPickerFailed', details: { cause: 'No activity' } },
    });
  });
});
