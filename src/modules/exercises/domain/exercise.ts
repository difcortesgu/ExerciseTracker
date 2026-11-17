import type { Brand } from '@shared/domain/brand';
import { domainError } from '@shared/domain/domain-error';
import type { ExerciseId } from '@shared/domain/ids';
import { err, map, ok, type Result } from '@shared/domain/result';

import { defaultTrackedMetrics } from './default-tracked-metrics';
import type { ValidatedExerciseDraft } from './exercise-draft';
import type { BuiltInReadOnlyError, InvalidExerciseDataError } from './exercise-errors';
import type { TrackedMetric } from './tracked-metric';
import type { VocabularyKey } from './vocabulary';

/**
 * The Exercise aggregate (PLAN §3, S1-08, ADR-004). Immutable; a discriminated union on `origin`
 * so built-in-only attributes (source key, level, force, mechanic, dataset images) and custom-only
 * ones (app-owned photos) cannot be mixed up. `isCustom` (PLAN §3) is derived from `origin`.
 *
 * Other modules (routines, workout, history) refer to exercises only by `ExerciseId`
 * (shared kernel). Ids never change: built-ins are updated in place by `sourceKey` on re-seed, and
 * deleting a custom exercise archives it (decision Q1), so references stay readable.
 *
 * Functions next to these types (S1-08/S1-10/S1-21):
 * - `isCustomExercise(exercise): exercise is CustomExercise`;
 * - `parseSeedSourceKey`, `parseDatasetImagePath`, `parsePhotoFileName` (the only way to create
 *   the branded strings below; `Result` with `exercises.invalid…` codes, never casts);
 * - `createCustomExercise(id, validated: ValidatedExerciseDraft): CustomExercise`;
 * - `updateCustomExercise(existing: Exercise, validated): Result<CustomExercise, BuiltInReadOnlyError>`
 *   (keeps `id`, `origin`, `archived`; returns a new instance);
 * - `archiveExercise(existing: Exercise): Result<CustomExercise, BuiltInReadOnlyError>`;
 * - `reviseCustomExercise(custom, validated): CustomExercise` (infallible form of the update);
 * - `requireCustomExercise(exercise): Result<CustomExercise, BuiltInReadOnlyError>` (shared guard);
 * - `createBuiltInExercise(id, data: BuiltInExerciseData): BuiltInExercise` (tracked metrics from
 *   `defaultTrackedMetrics`, S1-10).
 */

/** Stable key of a built-in in the dataset (the upstream id, e.g. `Barbell_Squat`). */
export type SeedSourceKey = Brand<string, 'SeedSourceKey'>;

/**
 * Path of a built-in image relative to the dataset's `exercises/` folder, e.g.
 * `Barbell_Squat/0.jpg`: `/`-separated, segments of `[A-Za-z0-9_.-]`, no empty, `.` or `..`
 * segment. The download URL is `manifest.imageBaseUrl + path` (infrastructure).
 */
export type DatasetImagePath = Brand<string, 'DatasetImagePath'>;

/** File name of an app-owned custom photo (`[A-Za-z0-9_-]+\.jpg`, no folders), ADR-004. */
export type PhotoFileName = Brand<string, 'PhotoFileName'>;

export type ExerciseOrigin = 'builtIn' | 'custom';
export type ExerciseLevel = 'beginner' | 'intermediate' | 'expert';
export type ExerciseForce = 'pull' | 'push' | 'static';
export type ExerciseMechanic = 'compound' | 'isolation';

/** An image of a built-in exercise, fetched on demand from the pinned dataset (S1-18). */
export interface BuiltInImage {
  readonly kind: 'builtIn';
  readonly path: DatasetImagePath;
  /** Exact file size from the pinned git tree; sums to the bulk-download estimate (S1-28). */
  readonly sizeBytes: number;
}

/** A photo of a custom exercise, copied into app storage (S1-22). */
export interface CustomPhoto {
  readonly kind: 'photo';
  readonly fileName: PhotoFileName;
}

export type ExerciseImage = BuiltInImage | CustomPhoto;

/** Attributes every exercise has, whatever its origin. */
interface ExerciseDefinition {
  readonly id: ExerciseId;
  /** Display-normalised (`normaliseDisplayText`), 1..80 characters. */
  readonly name: string;
  readonly category: VocabularyKey;
  /** At least one (assumption A3). */
  readonly primaryMuscles: readonly VocabularyKey[];
  /** Never contains a primary muscle. */
  readonly secondaryMuscles: readonly VocabularyKey[];
  /** `null` = not specified (77 built-ins have no equipment; optional for custom too). */
  readonly equipment: VocabularyKey | null;
  /** Ordered steps, none blank; may be empty (instructions are optional, assumption A6). */
  readonly instructions: readonly string[];
  /** Non-empty, de-duplicated, canonical order. */
  readonly trackedMetrics: readonly TrackedMetric[];
  /** Deleted custom exercise, or a built-in removed from the dataset: hidden, still readable by id. */
  readonly archived: boolean;
}

export interface BuiltInExercise extends ExerciseDefinition {
  readonly origin: 'builtIn';
  readonly sourceKey: SeedSourceKey;
  readonly level: ExerciseLevel;
  readonly force: ExerciseForce | null;
  readonly mechanic: ExerciseMechanic | null;
  /** 0..n dataset images (876 built-ins: 873 with two, three without). */
  readonly images: readonly BuiltInImage[];
}

export interface CustomExercise extends ExerciseDefinition {
  readonly origin: 'custom';
  /** 0..6 app-owned photos (assumption A5); the first is the cover. */
  readonly images: readonly CustomPhoto[];
}

export type Exercise = BuiltInExercise | CustomExercise;

/** A built-in as the seed describes it, before it has an id or derived tracked metrics (S1-12). */
export interface BuiltInExerciseData {
  readonly sourceKey: SeedSourceKey;
  readonly name: string;
  readonly category: VocabularyKey;
  readonly primaryMuscles: readonly VocabularyKey[];
  readonly secondaryMuscles: readonly VocabularyKey[];
  readonly equipment: VocabularyKey | null;
  readonly level: ExerciseLevel;
  readonly force: ExerciseForce | null;
  readonly mechanic: ExerciseMechanic | null;
  readonly instructions: readonly string[];
  readonly images: readonly BuiltInImage[];
}

/** One path segment of the dataset: an upstream id or a file name (no `.`/`..`, no spaces). */
const DATASET_SEGMENT = /^[A-Za-z0-9_.-]+$/;
const DOT_SEGMENTS: ReadonlySet<string> = new Set(['.', '..']);
const PHOTO_FILE_NAME = /^[A-Za-z0-9_-]+\.jpg$/;
const PATH_SEPARATOR = '/';

function isDatasetSegment(segment: string): boolean {
  return DATASET_SEGMENT.test(segment) && !DOT_SEGMENTS.has(segment);
}

function isSeedSourceKey(raw: string): raw is SeedSourceKey {
  return isDatasetSegment(raw);
}

function isDatasetImagePath(raw: string): raw is DatasetImagePath {
  return raw.split(PATH_SEPARATOR).every(isDatasetSegment);
}

function isPhotoFileName(raw: string): raw is PhotoFileName {
  return PHOTO_FILE_NAME.test(raw);
}

function invalid(
  code: InvalidExerciseDataError['code'],
  message: string,
  value: string,
): Result<never, InvalidExerciseDataError> {
  return err(domainError(code, message, { value }));
}

/** Validating factory of a built-in's stable dataset key (one path segment, e.g. `Barbell_Squat`). */
export function parseSeedSourceKey(raw: string): Result<SeedSourceKey, InvalidExerciseDataError> {
  return isSeedSourceKey(raw)
    ? ok(raw)
    : invalid('exercises.invalidSeedSourceKey', 'Not a valid dataset exercise id.', raw);
}

/** Validating factory of a dataset image path (`/`-separated segments, none empty, `.` or `..`). */
export function parseDatasetImagePath(
  raw: string,
): Result<DatasetImagePath, InvalidExerciseDataError> {
  return isDatasetImagePath(raw)
    ? ok(raw)
    : invalid('exercises.invalidDatasetImagePath', 'Not a valid dataset image path.', raw);
}

/** Validating factory of an app-owned photo file name (`<letters, digits, _ or ->.jpg`). */
export function parsePhotoFileName(raw: string): Result<PhotoFileName, InvalidExerciseDataError> {
  return isPhotoFileName(raw)
    ? ok(raw)
    : invalid('exercises.invalidPhotoFileName', 'Not a valid photo file name.', raw);
}

/** `isCustom` of PLAN §3, derived from the origin. */
export function isCustomExercise(exercise: Exercise): exercise is CustomExercise {
  return exercise.origin === 'custom';
}

function builtInReadOnly(exercise: Exercise): BuiltInReadOnlyError {
  return domainError('exercises.builtInReadOnly', 'Built-in exercises cannot be changed.', {
    id: exercise.id,
  });
}

/** The exercise as a custom one, or `exercises.builtInReadOnly` (decision Q2: built-ins are read-only). */
export function requireCustomExercise(
  exercise: Exercise,
): Result<CustomExercise, BuiltInReadOnlyError> {
  return isCustomExercise(exercise) ? ok(exercise) : err(builtInReadOnly(exercise));
}

function definitionOf(validated: ValidatedExerciseDraft) {
  const { name, category, primaryMuscles, secondaryMuscles, equipment } = validated;
  const { instructions, images, trackedMetrics } = validated;
  return {
    name,
    category,
    primaryMuscles,
    secondaryMuscles,
    equipment,
    instructions,
    images,
    trackedMetrics,
  };
}

/** A new, active custom exercise (S1-19); `validated` comes from `validateExerciseDraft`. */
export function createCustomExercise(
  id: ExerciseId,
  validated: ValidatedExerciseDraft,
): CustomExercise {
  return Object.freeze({ id, origin: 'custom', ...definitionOf(validated), archived: false });
}

/** A new instance with the edited fields; id, origin and archived flag never change (S1-20). */
export function updateCustomExercise(
  existing: Exercise,
  validated: ValidatedExerciseDraft,
): Result<CustomExercise, BuiltInReadOnlyError> {
  return map(requireCustomExercise(existing), (custom) => reviseCustomExercise(custom, validated));
}

/** A custom exercise with the edited fields, as a new instance; id, origin and archived stay. */
export function reviseCustomExercise(
  custom: CustomExercise,
  validated: ValidatedExerciseDraft,
): CustomExercise {
  return Object.freeze({ ...custom, ...definitionOf(validated) });
}

/** Deleting a custom exercise archives it (decision Q1): hidden, still readable by id. */
export function archiveExercise(existing: Exercise): Result<CustomExercise, BuiltInReadOnlyError> {
  return map(requireCustomExercise(existing), (custom) =>
    Object.freeze({ ...custom, archived: true }),
  );
}

/** A built-in from the seed, active, with its default tracked metrics (S1-10, S1-12). */
export function createBuiltInExercise(id: ExerciseId, data: BuiltInExerciseData): BuiltInExercise {
  return Object.freeze({
    id,
    origin: 'builtIn',
    ...data,
    trackedMetrics: defaultTrackedMetrics(data.category, data.equipment),
    archived: false,
  });
}
