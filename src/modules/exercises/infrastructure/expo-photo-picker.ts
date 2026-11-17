import {
  launchCameraAsync,
  launchImageLibraryAsync,
  requestCameraPermissionsAsync,
  type ImagePickerOptions,
  type ImagePickerResult,
  type MediaType,
} from 'expo-image-picker';

import { describeCause } from '@shared/domain/describe-cause';
import { domainError } from '@shared/domain/domain-error';
import { err, ok, type Result } from '@shared/domain/result';

import type {
  PhotoPicker,
  PhotoPickerError,
  PhotoSource,
  PickedPhoto,
} from '../application/photo-ports';

type PickResult = Result<PickedPhoto | null, PhotoPickerError>;

/** Images only, no cropping, full quality: the photo store downscales (ADR-004 §7). */
const IMAGES_ONLY: MediaType[] = ['images'];
const PICKER_OPTIONS: ImagePickerOptions = Object.freeze({
  mediaTypes: IMAGES_ONLY,
  allowsEditing: false,
  quality: 1,
});

/** Code of the native error Android raises when the user refuses a permission while launching. */
const USER_REJECTED_PERMISSIONS = 'ERR_USER_REJECTED_PERMISSIONS';

/**
 * Strategy per source: how to get permission (`true` = may open) and how to open it. The camera
 * needs the camera permission; Android's photo picker needs none.
 */
interface SourceLauncher {
  readonly ensurePermission: () => Promise<boolean>;
  readonly launch: (options: ImagePickerOptions) => Promise<ImagePickerResult>;
}

const LAUNCHERS: Readonly<Record<PhotoSource, SourceLauncher>> = Object.freeze({
  camera: {
    ensurePermission: async () => (await requestCameraPermissionsAsync()).granted,
    launch: launchCameraAsync,
  },
  library: {
    ensurePermission: () => Promise.resolve(true),
    launch: launchImageLibraryAsync,
  },
});

/**
 * Adapter (ports & adapters): the `PhotoPicker` port over `expo-image-picker` (works in Expo Go),
 * ADR-004 §7. Cancel → `ok(null)`; a denied permission → `exercises.photoPermissionDenied` with
 * its source; any other failure → `exercises.photoPickerFailed`. Never rejects.
 */
export class ExpoPhotoPicker implements PhotoPicker {
  async pick(source: PhotoSource): Promise<PickResult> {
    const launcher = LAUNCHERS[source];
    try {
      if (!(await launcher.ensurePermission())) return permissionDenied(source);
      return toPickedPhoto(await launcher.launch(PICKER_OPTIONS));
    } catch (cause) {
      return isPermissionRejection(cause) ? permissionDenied(source) : pickerFailed(cause);
    }
  }
}

function toPickedPhoto(result: ImagePickerResult): PickResult {
  if (result.canceled) return ok(null);
  const asset = result.assets[0];
  if (asset === undefined) return pickerFailed('The picker returned no image.');
  return ok(Object.freeze({ uri: asset.uri, width: asset.width, height: asset.height }));
}

function isPermissionRejection(cause: unknown): boolean {
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    cause.code === USER_REJECTED_PERMISSIONS
  );
}

function permissionDenied(source: PhotoSource): PickResult {
  return err(
    domainError('exercises.photoPermissionDenied', `Access to the ${source} was denied.`, {
      source,
    }),
  );
}

function pickerFailed(cause: unknown): PickResult {
  return err(
    domainError('exercises.photoPickerFailed', 'The photo could not be picked.', {
      cause: describeCause(cause),
    }),
  );
}
