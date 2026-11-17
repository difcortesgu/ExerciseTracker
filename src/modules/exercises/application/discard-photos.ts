import { createToken } from '@shared/application/di/token';
import type { Logger } from '@shared/application/logger';

import type { PhotoFileName } from '../domain/exercise';

import type { ExerciseReader } from './exercise-repository';
import { logged } from './library-use-case-support';
import { deletePhotosLogged } from './photo-cleanup';
import type { PhotoStore } from './photo-ports';

/**
 * Use case: deletes the photo copies a discarded form imported (S1-19 "Discard changes?", S1-22).
 * Safety net: a file referenced by any active exercise is **never** deleted, even if passed in.
 * Best effort: never rejects; failures are logged (the orphan cleanup removes leftovers later).
 *
 * Phase 2: `createDiscardPhotos(deps: { reader; photoStore; logger })`.
 */
export type DiscardPhotos = (fileNames: readonly PhotoFileName[]) => Promise<void>;

export const DiscardPhotosToken = createToken<DiscardPhotos>('exercises.DiscardPhotos');

export interface DiscardPhotosDependencies {
  readonly reader: ExerciseReader;
  readonly photoStore: PhotoStore;
  readonly logger: Logger;
}

export function createDiscardPhotos(deps: DiscardPhotosDependencies): DiscardPhotos {
  return async (fileNames) => {
    if (fileNames.length === 0) return;
    // Without the referenced names nothing is provably safe to delete: keep everything.
    const referenced = logged(
      deps.logger,
      'Discarded photos were kept; they are removed at a later start.',
      await deps.reader.listActivePhotoFileNames(),
    );
    if (!referenced.ok) return;
    await deletePhotosLogged(
      deps,
      fileNames.filter((fileName) => !referenced.value.has(fileName)),
    );
  };
}
