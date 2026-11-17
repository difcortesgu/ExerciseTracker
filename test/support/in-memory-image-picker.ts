/**
 * In-memory stand-in for the native `expo-image-picker` module (Sprint 1, S1-22). Adapter tests
 * mock exactly this boundary:
 *
 *   jest.mock('expo-image-picker', () =>
 *     jest.requireActual<typeof import('@test/support/in-memory-image-picker')>(
 *       '@test/support/in-memory-image-picker',
 *     ),
 *   );
 *
 * It mimics what the adapter relies on: a permission response object, `{ canceled, assets }`
 * results, and Android's rejection with the coded error `ERR_USER_REJECTED_PERMISSIONS` when the
 * user refuses a permission the picker asked for while launching.
 * Call `imagePicker.reset()` in `beforeEach`.
 */

interface PermissionResponseLike {
  readonly status: 'granted' | 'denied';
  readonly granted: boolean;
  readonly canAskAgain: boolean;
  readonly expires: 'never';
}

interface PickerAssetLike {
  readonly uri: string;
  readonly width: number;
  readonly height: number;
  readonly type: 'image';
  readonly fileName: string;
}

type PickerResultLike =
  | { readonly canceled: false; readonly assets: readonly PickerAssetLike[] }
  | { readonly canceled: true; readonly assets: null };

type PickerOptionsLike = Readonly<Record<string, unknown>>;

export type RecordedPickerCall =
  | { readonly method: 'requestCameraPermissionsAsync' }
  | {
      readonly method: 'launchCameraAsync' | 'launchImageLibraryAsync';
      readonly options: PickerOptionsLike | undefined;
    };

type Answer =
  | { readonly kind: 'resolve'; readonly result: PickerResultLike }
  | { readonly kind: 'reject'; readonly error: Error };

const CANCELLED: Answer = { kind: 'resolve', result: { canceled: true, assets: null } };
const USER_REJECTED_PERMISSIONS = 'ERR_USER_REJECTED_PERMISSIONS';

function permission(granted: boolean): PermissionResponseLike {
  return { status: granted ? 'granted' : 'denied', granted, canAskAgain: true, expires: 'never' };
}

class InMemoryImagePicker {
  calls: RecordedPickerCall[] = [];
  private cameraGranted = true;
  private permissionRequestError: Error | undefined;
  private answer: Answer = CANCELLED;

  reset(): void {
    this.calls = [];
    this.cameraGranted = true;
    this.permissionRequestError = undefined;
    this.answer = CANCELLED;
  }

  givenPicked(photo: { uri: string; width: number; height: number }): void {
    const fileName = photo.uri.slice(photo.uri.lastIndexOf('/') + 1);
    const asset: PickerAssetLike = { ...photo, type: 'image', fileName };
    this.answer = { kind: 'resolve', result: { canceled: false, assets: [asset] } };
  }

  givenCancelled(): void {
    this.answer = CANCELLED;
  }

  givenNoAssets(): void {
    this.answer = { kind: 'resolve', result: { canceled: false, assets: [] } };
  }

  givenCameraPermissionDenied(): void {
    this.cameraGranted = false;
  }

  givenPermissionRequestFails(error: Error): void {
    this.permissionRequestError = error;
  }

  givenLaunchRejects(error: Error): void {
    this.answer = { kind: 'reject', error };
  }

  givenLaunchPermissionRejected(): void {
    const error = Object.assign(new Error('User rejected permissions'), {
      code: USER_REJECTED_PERMISSIONS,
    });
    this.givenLaunchRejects(error);
  }

  requestCamera(): Promise<PermissionResponseLike> {
    this.calls.push({ method: 'requestCameraPermissionsAsync' });
    return this.permissionRequestError === undefined
      ? Promise.resolve(permission(this.cameraGranted))
      : Promise.reject(this.permissionRequestError);
  }

  launch(
    method: 'launchCameraAsync' | 'launchImageLibraryAsync',
    options: PickerOptionsLike | undefined,
  ): Promise<PickerResultLike> {
    this.calls.push({ method, options });
    return this.answer.kind === 'resolve'
      ? Promise.resolve(this.answer.result)
      : Promise.reject(this.answer.error);
  }
}

export const imagePicker = new InMemoryImagePicker();

export function requestCameraPermissionsAsync(): Promise<PermissionResponseLike> {
  return imagePicker.requestCamera();
}

export function launchCameraAsync(options?: PickerOptionsLike): Promise<PickerResultLike> {
  return imagePicker.launch('launchCameraAsync', options);
}

export function launchImageLibraryAsync(options?: PickerOptionsLike): Promise<PickerResultLike> {
  return imagePicker.launch('launchImageLibraryAsync', options);
}
