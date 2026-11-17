import { err, mapErr, ok, type Result } from '@shared/domain/result';

import type { ExerciseStorageError } from '../application/exercise-repository';
import { exerciseStorageFailed } from '../application/storage-failure';

import type { Decoded } from './exercise-decoders';

/** What every repository port method resolves to. */
export type Stored<T> = Promise<Result<T, ExerciseStorageError>>;

/**
 * Runs one synchronous SQLite operation for a repository port: a driver exception or a corrupt row
 * (decoding failure) becomes `exercises.storageFailed` with its cause; the promise never rejects
 * (port contract, S1-14).
 */
export function runStorage<T>(operation: () => Decoded<T>): Stored<T> {
  try {
    return Promise.resolve(mapErr(operation(), exerciseStorageFailed));
  } catch (cause) {
    return Promise.resolve(err(exerciseStorageFailed(cause)));
  }
}

/** Decodes every row in order; the first corrupt row fails the whole read. */
export function decodeRows<Row, T>(
  rows: readonly Row[],
  decode: (row: Row) => Decoded<T>,
): Decoded<readonly T[]> {
  const values: T[] = [];
  for (const row of rows) {
    const decoded = decode(row);
    if (!decoded.ok) return decoded;
    values.push(decoded.value);
  }
  return ok(Object.freeze(values));
}

/** Consecutive slices of at most `size` items (bounded statements in a seeding transaction). */
export function inBatches<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_unused, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}
