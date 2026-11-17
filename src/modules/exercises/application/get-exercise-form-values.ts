import { createToken } from '@shared/application/di/token';
import type { Logger } from '@shared/application/logger';
import type { ExerciseId } from '@shared/domain/ids';
import { ok, type Result } from '@shared/domain/result';

import { requireCustomExercise, type CustomPhoto } from '../domain/exercise';
import type { BuiltInReadOnlyError } from '../domain/exercise-errors';

import type { EnsureLibrarySeeded } from './ensure-library-seeded';
import { toExerciseFormValues } from './exercise-dto-mappers';
import type { ExerciseFormValues, PhotoView } from './exercise-dtos';
import type { ExerciseReader, VocabularyReader } from './exercise-repository';
import type { ExerciseLookupError } from './library-errors';
import { findActiveExercise, loadVocabulary, logged } from './library-use-case-support';
import type { PhotoStore } from './photo-ports';

/**
 * Use case: the edit form prefill of a custom exercise (S1-20): every current value, labels
 * resolved, instructions joined by line, photos with displayable URIs. Unknown or archived id →
 * `exercises.notFound`; built-in → `exercises.builtInReadOnly`. Never rejects.
 *
 * Phase 2: `createGetExerciseFormValues(deps: { ensureLibrarySeeded; reader; vocabularyReader;
 * photoStore; logger })`.
 */
export type GetExerciseFormValues = (
  id: ExerciseId,
) => Promise<Result<ExerciseFormValues, ExerciseLookupError | BuiltInReadOnlyError>>;

export const GetExerciseFormValuesToken = createToken<GetExerciseFormValues>(
  'exercises.GetExerciseFormValues',
);

export interface GetExerciseFormValuesDependencies {
  readonly ensureLibrarySeeded: EnsureLibrarySeeded;
  readonly reader: ExerciseReader;
  readonly vocabularyReader: VocabularyReader;
  readonly photoStore: PhotoStore;
  readonly logger: Logger;
}

/** Displayable photos in order; a photo whose file is missing cannot be shown and is left out. */
async function photoViews(
  photoStore: PhotoStore,
  photos: readonly CustomPhoto[],
): Promise<readonly PhotoView[]> {
  const views = await Promise.all(
    photos.map(async ({ fileName }) => ({ fileName, uri: await photoStore.localUri(fileName) })),
  );
  return views.flatMap(({ fileName, uri }) =>
    uri === null ? [] : [Object.freeze({ fileName, uri })],
  );
}

async function formValues(
  deps: GetExerciseFormValuesDependencies,
  id: ExerciseId,
): Promise<Result<ExerciseFormValues, ExerciseLookupError | BuiltInReadOnlyError>> {
  const seeded = await deps.ensureLibrarySeeded();
  if (!seeded.ok) return seeded;
  const exercise = await findActiveExercise(deps.reader, id);
  if (!exercise.ok) return exercise;
  const custom = requireCustomExercise(exercise.value);
  if (!custom.ok) return custom;
  const vocabulary = await loadVocabulary(deps.vocabularyReader);
  if (!vocabulary.ok) return vocabulary;
  const photos = await photoViews(deps.photoStore, custom.value.images);
  return ok(toExerciseFormValues(custom.value, vocabulary.value, photos));
}

export function createGetExerciseFormValues(
  deps: GetExerciseFormValuesDependencies,
): GetExerciseFormValues {
  return async (id) =>
    logged(
      deps.logger,
      'The exercise could not be opened for editing.',
      await formValues(deps, id),
    );
}
