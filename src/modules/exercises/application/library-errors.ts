import type { DomainError } from '@shared/domain/domain-error';

import type { ExerciseNotFoundError } from '../domain/exercise-errors';

import type { ExerciseStorageError } from './exercise-repository';
import type { SeedSourceError } from './library-seed-ports';

/**
 * Why the library could not be prepared (S1-13): the bundled seed is invalid, or writing it failed
 * (the store's `exercises.storageFailed` is reported as `exercises.seedFailed` with the cause).
 */
export type LibrarySeedError = SeedSourceError | DomainError<'exercises.seedFailed'>;

/** Why browsing failed: seeding failed (A9: no partial library) or storage failed. */
export type ExerciseLibraryError = LibrarySeedError | ExerciseStorageError;

/** Why one exercise could not be shown. */
export type ExerciseLookupError = ExerciseLibraryError | ExerciseNotFoundError;
