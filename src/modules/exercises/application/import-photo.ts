import { createToken } from '@shared/application/di/token';
import type { Logger } from '@shared/application/logger';
import { domainError } from '@shared/domain/domain-error';
import { err, ok, type Result } from '@shared/domain/result';

import type { PhotoView } from './exercise-dtos';
import { logged } from './library-use-case-support';
import type {
  PhotoPicker,
  PhotoPickerError,
  PhotoSource,
  PhotoStore,
  PhotoStoreError,
} from './photo-ports';

/**
 * Use case: "Add photo" in the form (S1-22): opens the camera or the gallery through `PhotoPicker`,
 * then stores an app-owned, downscaled copy through `PhotoStore`. `ok(null)` when the user
 * cancels. The copy is not referenced by any exercise until the form is saved; a discarded form
 * hands it to `DiscardPhotos`. Never rejects; failures other than permission denial are logged.
 *
 * Phase 2: `createImportPhoto(deps: { picker: PhotoPicker; photoStore: PhotoStore; logger })`.
 */
export type ImportPhoto = (
  source: PhotoSource,
) => Promise<Result<PhotoView | null, PhotoPickerError | PhotoStoreError>>;

export const ImportPhotoToken = createToken<ImportPhoto>('exercises.ImportPhoto');

export interface ImportPhotoDependencies {
  readonly picker: PhotoPicker;
  readonly photoStore: PhotoStore;
  readonly logger: Logger;
}

type ImportOutcome = Result<PhotoView | null, PhotoPickerError | PhotoStoreError>;

async function importFrom(
  deps: ImportPhotoDependencies,
  source: PhotoSource,
): Promise<ImportOutcome> {
  const picked = await deps.picker.pick(source);
  if (!picked.ok) return picked;
  if (picked.value === null) return ok(null);
  const stored = await deps.photoStore.importPhoto(picked.value);
  if (!stored.ok) return stored;
  const uri = await deps.photoStore.localUri(stored.value);
  return uri === null
    ? err(
        domainError('exercises.photoImportFailed', 'The stored photo could not be found.', {
          cause: `Missing after import: ${stored.value}`,
        }),
      )
    : ok(Object.freeze({ fileName: stored.value, uri }));
}

export function createImportPhoto(deps: ImportPhotoDependencies): ImportPhoto {
  return async (source) =>
    logged(deps.logger, 'The photo could not be added.', await importFrom(deps, source));
}
