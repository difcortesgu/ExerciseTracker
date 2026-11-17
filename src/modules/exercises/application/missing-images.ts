import { ok, type Result } from '@shared/domain/result';

import type { BuiltInImage } from '../domain/exercise';

import type { BuiltInImageCache } from './built-in-image-cache';
import type { EnsureLibrarySeeded } from './ensure-library-seeded';
import type { BuiltInImageCatalog } from './exercise-repository';
import type { ExerciseLibraryError } from './library-errors';

export interface MissingImagesDependencies {
  readonly ensureLibrarySeeded: EnsureLibrarySeeded;
  readonly catalog: BuiltInImageCatalog;
  readonly imageCache: BuiltInImageCache;
}

export interface MissingImages {
  /** Images of active built-ins that are not cached, in catalogue order. */
  readonly images: readonly BuiltInImage[];
  /** Every image of every active built-in. */
  readonly totalCount: number;
}

/** Active built-in images minus the cached ones (S1-28: estimate and the run's work list). */
export async function listMissingImages(
  deps: MissingImagesDependencies,
): Promise<Result<MissingImages, ExerciseLibraryError>> {
  const seeded = await deps.ensureLibrarySeeded();
  if (!seeded.ok) return seeded;
  const catalogue = await deps.catalog.listActiveBuiltInImages();
  if (!catalogue.ok) return catalogue;
  const cached = await deps.imageCache.cachedPaths();
  const images = catalogue.value.filter(({ path }) => !cached.has(path));
  return ok(Object.freeze({ images: Object.freeze(images), totalCount: catalogue.value.length }));
}
