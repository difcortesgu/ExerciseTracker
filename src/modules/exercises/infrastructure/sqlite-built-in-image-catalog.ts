import { and, eq } from 'drizzle-orm';

import { map } from '@shared/domain/result';
import type { SqliteDatabase } from '@shared/infrastructure/db/sqlite-database';

import type { BuiltInImageCatalog } from '../application/exercise-repository';
import type { BuiltInImage } from '../domain/exercise';

import { builtInImagesFromColumn } from './exercise-row-mapper';
import { exercises } from './exercises.schema';
import { decodeRows, runStorage, type Stored } from './sqlite-storage';

/** Each path once (two built-ins may share an image), ordered by path. */
function uniqueByPath(images: readonly BuiltInImage[]): readonly BuiltInImage[] {
  const byPath = new Map(images.map((image) => [image.path, image]));
  return [...byPath.values()].sort((first, second) => (first.path < second.path ? -1 : 1));
}

/** Adapter (Repository): `BuiltInImageCatalog` on SQLite, for the bulk download (S1-28). */
export class SqliteBuiltInImageCatalog implements BuiltInImageCatalog {
  constructor(private readonly database: SqliteDatabase) {}

  listActiveBuiltInImages(): Stored<readonly BuiltInImage[]> {
    return runStorage(() => {
      const rows = this.database
        .select({ images: exercises.images })
        .from(exercises)
        .where(and(eq(exercises.origin, 'builtIn'), eq(exercises.archived, false)))
        .all();
      return map(
        decodeRows(rows, ({ images }) => builtInImagesFromColumn(images)),
        (perExercise) => uniqueByPath(perExercise.flat()),
      );
    });
  }
}
