import type { Exercise } from '../domain/exercise';
import { formatInstructions } from '../domain/exercise-draft';
import type { ExerciseSummary } from '../domain/exercise-summary';
import type {
  Vocabulary,
  VocabularyKey,
  VocabularyKind,
  VocabularyValue,
} from '../domain/vocabulary';

import type {
  ExerciseDetails,
  ExerciseFormValues,
  ExerciseListItem,
  PhotoView,
  VocabularyOption,
  VocabularyOptions,
} from './exercise-dtos';

/**
 * Mappers from domain values to the DTOs presentation receives (S1-15 to S1-23): labels resolved
 * from the merged vocabulary, so screens never look values up. A key without a stored label (should
 * not happen) is shown with the key itself.
 */

export const toVocabularyOption = ({ key, label, origin }: VocabularyValue): VocabularyOption =>
  Object.freeze({ key, label, isCustom: origin === 'custom' });

export function optionFor(
  vocabulary: Vocabulary,
  kind: VocabularyKind,
  key: VocabularyKey,
): VocabularyOption {
  const value = vocabulary[kind].find((candidate) => candidate.key === key);
  return value === undefined
    ? Object.freeze({ key, label: key, isCustom: false })
    : toVocabularyOption(value);
}

const optionsFor = (
  vocabulary: Vocabulary,
  kind: VocabularyKind,
  keys: readonly VocabularyKey[],
): readonly VocabularyOption[] =>
  Object.freeze(keys.map((key) => optionFor(vocabulary, kind, key)));

const equipmentOption = (vocabulary: Vocabulary, key: VocabularyKey | null) =>
  key === null ? null : optionFor(vocabulary, 'equipment', key);

export function toVocabularyOptions(vocabulary: Vocabulary): VocabularyOptions {
  return Object.freeze({
    category: Object.freeze(vocabulary.category.map(toVocabularyOption)),
    muscle: Object.freeze(vocabulary.muscle.map(toVocabularyOption)),
    equipment: Object.freeze(vocabulary.equipment.map(toVocabularyOption)),
  });
}

export function toExerciseListItem(
  summary: ExerciseSummary,
  vocabulary: Vocabulary,
): ExerciseListItem {
  return Object.freeze({
    id: summary.id,
    name: summary.name,
    isCustom: summary.origin === 'custom',
    categoryLabel: optionFor(vocabulary, 'category', summary.category).label,
    primaryMuscleLabels: Object.freeze(
      optionsFor(vocabulary, 'muscle', summary.primaryMuscles).map(({ label }) => label),
    ),
    equipmentLabel: equipmentOption(vocabulary, summary.equipment)?.label ?? null,
    coverImage: summary.coverImage,
  });
}

export function toExerciseDetails(exercise: Exercise, vocabulary: Vocabulary): ExerciseDetails {
  return Object.freeze({
    id: exercise.id,
    name: exercise.name,
    isCustom: exercise.origin === 'custom',
    category: optionFor(vocabulary, 'category', exercise.category),
    primaryMuscles: optionsFor(vocabulary, 'muscle', exercise.primaryMuscles),
    secondaryMuscles: optionsFor(vocabulary, 'muscle', exercise.secondaryMuscles),
    equipment: equipmentOption(vocabulary, exercise.equipment),
    instructions: exercise.instructions,
    images: exercise.images,
    trackedMetrics: exercise.trackedMetrics,
    builtIn:
      exercise.origin === 'builtIn'
        ? Object.freeze({
            level: exercise.level,
            force: exercise.force,
            mechanic: exercise.mechanic,
          })
        : null,
  });
}

/** Form prefill (edit S1-20, duplicate S1-23); `photos` are the displayable photos to show. */
export function toExerciseFormValues(
  exercise: Exercise,
  vocabulary: Vocabulary,
  photos: readonly PhotoView[],
): ExerciseFormValues {
  return Object.freeze({
    name: exercise.name,
    category: optionFor(vocabulary, 'category', exercise.category),
    primaryMuscles: optionsFor(vocabulary, 'muscle', exercise.primaryMuscles),
    secondaryMuscles: optionsFor(vocabulary, 'muscle', exercise.secondaryMuscles),
    equipment: equipmentOption(vocabulary, exercise.equipment),
    instructionsText: formatInstructions(exercise.instructions),
    photos: Object.freeze([...photos]),
    trackedMetrics: exercise.trackedMetrics,
  });
}
