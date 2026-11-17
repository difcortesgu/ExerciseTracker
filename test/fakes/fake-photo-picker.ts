import type {
  PhotoPicker,
  PhotoPickerError,
  PhotoSource,
  PickedPhoto,
} from '@modules/exercises/application/photo-ports';
import { domainError } from '@shared/domain/domain-error';
import { err, ok, type Result } from '@shared/domain/result';

type PickResult = Result<PickedPhoto | null, PhotoPickerError>;

const DEFAULT_PHOTO: PickedPhoto = Object.freeze({
  uri: 'file:///data/user/0/app/cache/ImagePicker/picked.jpg',
  width: 4000,
  height: 3000,
});

/** Fake `PhotoPicker`: answers what the test arranged (a default photo) and records sources. */
export class FakePhotoPicker implements PhotoPicker {
  readonly requestedSources: PhotoSource[] = [];
  private answer: PickResult = ok(DEFAULT_PHOTO);
  private readonly denied = new Set<PhotoSource>();

  respondWith(photo: PickedPhoto): void {
    this.answer = ok(photo);
  }

  cancel(): void {
    this.answer = ok(null);
  }

  denyPermission(source: PhotoSource): void {
    this.denied.add(source);
  }

  fail(): void {
    this.answer = err(
      domainError('exercises.photoPickerFailed', 'The picker failed.', { cause: 'Activity lost' }),
    );
  }

  pick(source: PhotoSource): Promise<PickResult> {
    this.requestedSources.push(source);
    if (this.denied.has(source)) {
      return Promise.resolve(
        err(domainError('exercises.photoPermissionDenied', 'Access was denied.', { source })),
      );
    }
    return Promise.resolve(this.answer);
  }
}
