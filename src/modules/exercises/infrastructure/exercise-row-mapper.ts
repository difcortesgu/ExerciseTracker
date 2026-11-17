import { andThen, err, map, mapErr, ok } from '@shared/domain/result';

import { comparisonKey } from '../domain/comparison-key';
import {
  isCustomExercise,
  type BuiltInExercise,
  type CustomExercise,
  type Exercise,
  type ExerciseImage,
  type ExerciseOrigin,
  type PhotoFileName,
} from '../domain/exercise';
import type { ExerciseSummary } from '../domain/exercise-summary';

import { decodeFields } from './decoded-fields';
import {
  decodeBuiltInImages,
  decodeExerciseId,
  decodeForce,
  decodeJson,
  decodeLevel,
  decodeMechanic,
  decodePhotos,
  decodeSeedSourceKey,
  decodeText,
  decodeTextList,
  decodeTrackedMetrics,
  decodeVocabularyKey,
  decodeVocabularyKeys,
  nullable,
  type Decoded,
  type Decoder,
} from './exercise-decoders';
import type { ExerciseRow } from './exercises.schema';

/**
 * Data Mapper between `exercises` rows and the Exercise aggregate (S1-14, ADR-004 §2). Writing
 * derives `name_key` and encodes list fields as JSON; reading validates every column, so a corrupt
 * row becomes a described failure (the adapters report `exercises.storageFailed`), never a crash
 * or an invalid domain value.
 */

/** The columns a library summary needs (no instructions, no built-in attributes). */
export type ExerciseSummaryRow = Pick<
  ExerciseRow,
  'id' | 'name' | 'origin' | 'category' | 'primaryMuscles' | 'equipment' | 'images'
>;

const fromJson =
  <T>(decoder: Decoder<T>) =>
  (column: string): Decoded<T> =>
    andThen(decodeJson(column), decoder);

const decodeEquipment = nullable(decodeVocabularyKey);

export const builtInImagesFromColumn = fromJson(decodeBuiltInImages);
const photosFromColumn = fromJson(decodePhotos);

/** File names of the photos in a custom exercise's `images` column. */
export function photoFileNamesFromColumn(column: string): Decoded<readonly PhotoFileName[]> {
  return map(photosFromColumn(column), (photos) => photos.map(({ fileName }) => fileName));
}

function encodeImages(exercise: Exercise): string {
  return isCustomExercise(exercise)
    ? JSON.stringify(exercise.images.map(({ fileName }) => fileName))
    : JSON.stringify(exercise.images.map(({ path, sizeBytes }) => ({ path, sizeBytes })));
}

export function exerciseToRow(exercise: Exercise): ExerciseRow {
  const builtIn = isCustomExercise(exercise) ? null : exercise;
  return {
    id: exercise.id,
    origin: exercise.origin,
    sourceKey: builtIn?.sourceKey ?? null,
    name: exercise.name,
    nameKey: comparisonKey(exercise.name),
    category: exercise.category,
    equipment: exercise.equipment,
    level: builtIn?.level ?? null,
    force: builtIn?.force ?? null,
    mechanic: builtIn?.mechanic ?? null,
    primaryMuscles: JSON.stringify(exercise.primaryMuscles),
    secondaryMuscles: JSON.stringify(exercise.secondaryMuscles),
    instructions: JSON.stringify(exercise.instructions),
    images: encodeImages(exercise),
    trackedMetrics: JSON.stringify(exercise.trackedMetrics),
    archived: exercise.archived,
  };
}

function definitionFields(row: ExerciseRow) {
  return {
    id: decodeExerciseId(row.id),
    name: decodeText(row.name),
    category: decodeVocabularyKey(row.category),
    primaryMuscles: fromJson(decodeVocabularyKeys)(row.primaryMuscles),
    secondaryMuscles: fromJson(decodeVocabularyKeys)(row.secondaryMuscles),
    equipment: decodeEquipment(row.equipment),
    instructions: fromJson(decodeTextList)(row.instructions),
    trackedMetrics: fromJson(decodeTrackedMetrics)(row.trackedMetrics),
  };
}

function builtInFromRow(row: ExerciseRow): Decoded<BuiltInExercise> {
  const decoded = decodeFields({
    ...definitionFields(row),
    sourceKey: decodeSeedSourceKey(row.sourceKey),
    level: decodeLevel(row.level),
    force: nullable(decodeForce)(row.force),
    mechanic: nullable(decodeMechanic)(row.mechanic),
    images: builtInImagesFromColumn(row.images),
  });
  return map(decoded, (fields) =>
    Object.freeze({
      id: fields.id.value,
      origin: 'builtIn' as const,
      sourceKey: fields.sourceKey.value,
      name: fields.name.value,
      category: fields.category.value,
      primaryMuscles: fields.primaryMuscles.value,
      secondaryMuscles: fields.secondaryMuscles.value,
      equipment: fields.equipment.value,
      level: fields.level.value,
      force: fields.force.value,
      mechanic: fields.mechanic.value,
      instructions: fields.instructions.value,
      images: fields.images.value,
      trackedMetrics: fields.trackedMetrics.value,
      archived: row.archived,
    }),
  );
}

function customFromRow(row: ExerciseRow): Decoded<CustomExercise> {
  const decoded = decodeFields({ ...definitionFields(row), images: photosFromColumn(row.images) });
  return map(decoded, (fields) =>
    Object.freeze({
      id: fields.id.value,
      origin: 'custom' as const,
      name: fields.name.value,
      category: fields.category.value,
      primaryMuscles: fields.primaryMuscles.value,
      secondaryMuscles: fields.secondaryMuscles.value,
      equipment: fields.equipment.value,
      instructions: fields.instructions.value,
      images: fields.images.value,
      trackedMetrics: fields.trackedMetrics.value,
      archived: row.archived,
    }),
  );
}

function decodeOrigin(raw: string): Decoded<ExerciseOrigin> {
  return raw === 'builtIn' || raw === 'custom' ? ok(raw) : err(`origin: unknown origin "${raw}"`);
}

const describingRow =
  (id: string) =>
  (reason: string): string =>
    `exercise "${id}": ${reason}`;

export function exerciseFromRow(row: ExerciseRow): Decoded<Exercise> {
  const decoded = andThen(decodeOrigin(row.origin), (origin): Decoded<Exercise> =>
    origin === 'builtIn' ? builtInFromRow(row) : customFromRow(row),
  );
  return mapErr(decoded, describingRow(row.id));
}

/** A row that must be a built-in (seeding reads built-ins only). */
export function builtInExerciseFromRow(row: ExerciseRow): Decoded<BuiltInExercise> {
  const decoded =
    row.origin === 'builtIn'
      ? builtInFromRow(row)
      : err(`origin: expected a built-in, got "${row.origin}"`);
  return mapErr(decoded, describingRow(row.id));
}

function coverImageFromRow(origin: ExerciseOrigin, images: string): Decoded<ExerciseImage | null> {
  const decoded: Decoded<readonly ExerciseImage[]> =
    origin === 'builtIn' ? builtInImagesFromColumn(images) : photosFromColumn(images);
  return map(decoded, (list) => list[0] ?? null);
}

export function summaryFromRow(row: ExerciseSummaryRow): Decoded<ExerciseSummary> {
  const decoded = andThen(decodeOrigin(row.origin), (origin) =>
    map(
      decodeFields({
        id: decodeExerciseId(row.id),
        name: decodeText(row.name),
        category: decodeVocabularyKey(row.category),
        primaryMuscles: fromJson(decodeVocabularyKeys)(row.primaryMuscles),
        equipment: decodeEquipment(row.equipment),
        coverImage: coverImageFromRow(origin, row.images),
      }),
      (fields): ExerciseSummary =>
        Object.freeze({
          id: fields.id.value,
          name: fields.name.value,
          origin,
          category: fields.category.value,
          primaryMuscles: fields.primaryMuscles.value,
          equipment: fields.equipment.value,
          coverImage: fields.coverImage.value,
        }),
    ),
  );
  return mapErr(decoded, describingRow(row.id));
}
