import type { ExerciseId } from '@shared/domain/ids';

import type { Exercise, ExerciseImage, ExerciseOrigin } from './exercise';
import type { VocabularyKey } from './vocabulary';

/**
 * Lightweight read model of an active exercise for the library list, search and filters (S1-14,
 * S1-09): no instructions, only the cover image. The reader returns only active (not archived)
 * exercises, so search can never show a deleted one.
 */
export interface ExerciseSummary {
  readonly id: ExerciseId;
  readonly name: string;
  readonly origin: ExerciseOrigin;
  readonly category: VocabularyKey;
  readonly primaryMuscles: readonly VocabularyKey[];
  readonly equipment: VocabularyKey | null;
  /** First image or photo, `null` when there is none. */
  readonly coverImage: ExerciseImage | null;
}

/** The summary of an exercise (Data Mapper used by every reader implementation, S1-14). */
export function summariseExercise(exercise: Exercise): ExerciseSummary {
  const { id, name, origin, category, primaryMuscles, equipment, images } = exercise;
  return Object.freeze({
    id,
    name,
    origin,
    category,
    primaryMuscles,
    equipment,
    coverImage: images[0] ?? null,
  });
}
