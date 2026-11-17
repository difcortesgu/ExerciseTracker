import type { ExerciseId } from '@shared/domain/ids';

import type {
  ExerciseForce,
  ExerciseImage,
  ExerciseLevel,
  ExerciseMechanic,
  PhotoFileName,
} from '../domain/exercise';
import type { ExerciseDraft } from '../domain/exercise-draft';
import type { ExerciseQuery } from '../domain/exercise-query';
import type { TrackedMetric } from '../domain/tracked-metric';
import type { VocabularyKey, VocabularyKind, VocabularySelection } from '../domain/vocabulary';

/**
 * Data the exercises use cases exchange with presentation (S1-15 to S1-23, S1-29). Plain, immutable
 * data with display labels already resolved, so screens never look values up or apply rules.
 * Mappers from domain values to these DTOs live in the application layer (Phase 2, core-dev). A key
 * without a stored label (should not happen) is shown with the key itself as its label.
 */

/** One selectable vocabulary value (pickers and filters), built-in and user-defined together. */
export interface VocabularyOption {
  readonly key: VocabularyKey;
  readonly label: string;
  /** User-defined (S1-29); the UI may mark it "Custom" where it helps. */
  readonly isCustom: boolean;
}

/** Every option per vocabulary, one entry per key, alphabetical (case/accent-insensitive). */
export type VocabularyOptions = Readonly<Record<VocabularyKind, readonly VocabularyOption[]>>;

/**
 * Opaque reference to an exercise image or photo. Presentation never reads its fields: it passes
 * it to `GetExerciseImage` to obtain something displayable.
 */
export type ExerciseImageRef = ExerciseImage;

/** Search text + filters of the library screen (S1-09, S1-16). */
export type ExerciseSearchQuery = ExerciseQuery;

/** One row of the library list (S1-16). The result count is the length of the list. */
export interface ExerciseListItem {
  readonly id: ExerciseId;
  readonly name: string;
  /** Shows the "Custom" badge. */
  readonly isCustom: boolean;
  readonly categoryLabel: string;
  readonly primaryMuscleLabels: readonly string[];
  readonly equipmentLabel: string | null;
  /** Thumbnail; `null` → placeholder without a request. */
  readonly coverImage: ExerciseImageRef | null;
}

/** Built-in-only attributes shown on the detail screen (S1-17). */
export interface BuiltInAttributes {
  readonly level: ExerciseLevel;
  readonly force: ExerciseForce | null;
  readonly mechanic: ExerciseMechanic | null;
}

/** Everything the detail screen shows (S1-17). */
export interface ExerciseDetails {
  readonly id: ExerciseId;
  readonly name: string;
  /** `true`: offer Edit and Delete. `false` (built-in): offer Duplicate as custom only (Q2). */
  readonly isCustom: boolean;
  readonly category: VocabularyOption;
  readonly primaryMuscles: readonly VocabularyOption[];
  readonly secondaryMuscles: readonly VocabularyOption[];
  readonly equipment: VocabularyOption | null;
  /** Numbered steps; may be empty. */
  readonly instructions: readonly string[];
  /** Gallery in order; empty → neutral placeholder. */
  readonly images: readonly ExerciseImageRef[];
  readonly trackedMetrics: readonly TrackedMetric[];
  /** `null` for custom exercises. */
  readonly builtIn: BuiltInAttributes | null;
}

/** An app-owned photo with a displayable URI (form thumbnails, S1-22). */
export interface PhotoView {
  readonly fileName: PhotoFileName;
  readonly uri: string;
}

/**
 * Initial values of the custom-exercise form: edit prefill (S1-20) or "Duplicate as custom"
 * prefill (S1-23). A blank create form is built by presentation (empty strings and lists, `null`).
 */
export interface ExerciseFormValues {
  readonly name: string;
  readonly category: VocabularyOption | null;
  readonly primaryMuscles: readonly VocabularyOption[];
  readonly secondaryMuscles: readonly VocabularyOption[];
  readonly equipment: VocabularyOption | null;
  /** Steps joined with `\n` (A6). */
  readonly instructionsText: string;
  readonly photos: readonly PhotoView[];
  readonly trackedMetrics: readonly TrackedMetric[];
}

/**
 * What the form submits on Save (create and edit). Existing options are sent as
 * `{ source: 'existing', key: option.key }`; values added with "Add your own" as the `selection`
 * returned by `ResolveVocabularyValue`.
 */
export type ExerciseInput = ExerciseDraft;

/** Result of "Add your own" in a picker (S1-29), before anything is persisted. */
export interface ResolvedVocabularyOption {
  /** What the picker shows as selected (an existing value when the text matched one). */
  readonly option: VocabularyOption;
  /** What the form sends for this value on Save. */
  readonly selection: VocabularySelection;
}

/** Something the UI can display for an image (S1-18). */
export type ImageSource =
  | { readonly status: 'available'; readonly uri: string }
  /** Never cached and offline, download failed, or photo file missing: show the placeholder. */
  | { readonly status: 'unavailable' };
