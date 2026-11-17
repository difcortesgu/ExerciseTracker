import {
  imagePicker,
  launchCameraAsync,
  launchImageLibraryAsync,
  requestCameraPermissionsAsync,
} from './in-memory-image-picker';

const PHOTO = { uri: 'file:///picker/a.jpg', width: 40, height: 30 };

describe('in-memory expo-image-picker stand-in', () => {
  beforeEach(() => {
    imagePicker.reset();
  });

  it('grants the camera permission by default and records the request', async () => {
    expect(await requestCameraPermissionsAsync()).toMatchObject({
      granted: true,
      status: 'granted',
    });
    expect(imagePicker.calls).toEqual([{ method: 'requestCameraPermissionsAsync' }]);
  });

  it('can deny the camera permission', async () => {
    imagePicker.givenCameraPermissionDenied();

    expect(await requestCameraPermissionsAsync()).toMatchObject({
      granted: false,
      status: 'denied',
    });
  });

  it('returns the arranged photo from the camera or the library, recording the options', async () => {
    imagePicker.givenPicked(PHOTO);
    const options = { mediaTypes: ['images' as const], quality: 1 };

    expect(await launchCameraAsync(options)).toEqual({
      canceled: false,
      assets: [{ ...PHOTO, type: 'image', fileName: 'a.jpg' }],
    });
    expect(await launchImageLibraryAsync(options)).toMatchObject({ canceled: false });
    expect(imagePicker.calls).toEqual([
      { method: 'launchCameraAsync', options },
      { method: 'launchImageLibraryAsync', options },
    ]);
  });

  it('cancels with no assets', async () => {
    imagePicker.givenCancelled();

    expect(await launchImageLibraryAsync()).toEqual({ canceled: true, assets: null });
  });

  it('can answer with no assets at all, or reject like the native module', async () => {
    imagePicker.givenNoAssets();
    expect(await launchCameraAsync()).toEqual({ canceled: false, assets: [] });

    imagePicker.givenLaunchRejects(new Error('Activity lost'));
    await expect(launchCameraAsync()).rejects.toThrow('Activity lost');
  });

  it('rejects like Android when the user refused the permission while launching', async () => {
    imagePicker.givenLaunchPermissionRejected();

    await expect(launchImageLibraryAsync()).rejects.toMatchObject({
      code: 'ERR_USER_REJECTED_PERMISSIONS',
    });
  });

  it('can make the permission request itself fail', async () => {
    imagePicker.givenPermissionRequestFails(new Error('No activity'));

    await expect(requestCameraPermissionsAsync()).rejects.toThrow('No activity');
  });
});
