import { describeCause } from '@shared/domain/describe-cause';
import { domainError } from '@shared/domain/domain-error';

import type { ExerciseStorageError } from './exercise-repository';

/** The `exercises.storageFailed` error every repository implementation returns (S1-14). */
export function exerciseStorageFailed(cause: unknown): ExerciseStorageError {
  return domainError(
    'exercises.storageFailed',
    'The exercise library could not be read or written.',
    { cause: describeCause(cause) },
  );
}
