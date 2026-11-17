import { createToken } from '@shared/application/di/token';
import type { Logger } from '@shared/application/logger';
import { ok, type Result } from '@shared/domain/result';

import type { ExerciseReader, ExerciseStorageError } from './exercise-repository';
import { logged } from './library-use-case-support';
import type { PhotoStore, PhotoStoreError } from './photo-ports';

/**
 * Use case: removes photo files no active exercise refers to (S1-22: leftovers of a crash
 * mid-edit, failed deletions, archived exercises). Runs as a background startup task after the
 * migrations, never delaying startup.
 *
 * Order matters: (1) list the stored files, (2) read the referenced names, (3) delete
 * listed − referenced. A photo imported after step 1 is therefore never deleted. Files referenced
 * by an active exercise are never deleted (contract test). Returns how many files were deleted;
 * never rejects; failures are logged.
 *
 * Phase 2: `createCleanUpOrphanPhotos(deps: { reader; photoStore; logger })`.
 */
export type CleanUpOrphanPhotos = () => Promise<
  Result<number, ExerciseStorageError | PhotoStoreError>
>;

export const CleanUpOrphanPhotosToken = createToken<CleanUpOrphanPhotos>(
  'exercises.CleanUpOrphanPhotos',
);

export interface CleanUpOrphanPhotosDependencies {
  readonly reader: ExerciseReader;
  readonly photoStore: PhotoStore;
  readonly logger: Logger;
}

type CleanUpOutcome = Result<number, ExerciseStorageError | PhotoStoreError>;

async function cleanUp(deps: CleanUpOrphanPhotosDependencies): Promise<CleanUpOutcome> {
  const stored = await deps.photoStore.listPhotos();
  if (!stored.ok) return stored;
  const referenced = await deps.reader.listActivePhotoFileNames();
  if (!referenced.ok) return referenced;
  const orphans = stored.value.filter((fileName) => !referenced.value.has(fileName));
  if (orphans.length === 0) return ok(0);
  const deleted = await deps.photoStore.deletePhotos(orphans);
  return deleted.ok ? ok(orphans.length) : deleted;
}

export function createCleanUpOrphanPhotos(
  deps: CleanUpOrphanPhotosDependencies,
): CleanUpOrphanPhotos {
  return async () =>
    logged(deps.logger, 'Orphan photos could not be removed.', await cleanUp(deps));
}
