import { createToken } from '@shared/application/di/token';
import type { DomainError } from '@shared/domain/domain-error';
import type { Result } from '@shared/domain/result';

import type { BuiltInExercise, BuiltInExerciseData } from '../domain/exercise';
import type { LibrarySeedPlan } from '../domain/library-seed';
import type { VocabularyValue } from '../domain/vocabulary';

import type { ExerciseStorageError } from './exercise-repository';

/** The pinned upstream dataset, as recorded in `assets/exercise-db/manifest.json` (ADR-004). */
export interface DatasetSource {
  readonly name: string;
  readonly repositoryUrl: string;
  /** Full commit SHA the seed and the image URLs are pinned to. */
  readonly commit: string;
  readonly licence: { readonly name: string; readonly url: string };
}

/** Small metadata of the bundled seed, available without loading the seed itself. */
export interface SeedManifest {
  /** Strictly increases whenever the seeded content changes (S1-11). */
  readonly seedVersion: number;
  readonly source: DatasetSource;
  /** Prefix of every `DatasetImagePath` (ends with `/`), at the pinned commit (S1-18). */
  readonly imageBaseUrl: string;
  readonly counts: {
    readonly exercises: number;
    readonly images: number;
    readonly imageBytes: number;
  };
}

/** The seed content, validated and mapped to domain values by the seed source adapter. */
export interface SeedDataset {
  /** Equals `manifest.seedVersion` (the adapter rejects a mismatch). */
  readonly seedVersion: number;
  /** Built-in vocabulary values (origin `builtIn`, labels from the asset). */
  readonly vocabulary: readonly VocabularyValue[];
  readonly exercises: readonly BuiltInExerciseData[];
}

/** The bundled seed is unreadable, of another format version, or fails validation. */
export type SeedSourceError = DomainError<'exercises.seedAssetInvalid'>;

/**
 * Port: the bundled built-in library (`assets/exercise-db/`, S1-11). The adapter is the only code
 * that reads the asset (lint-enforced).
 *
 * Contract: `manifest` is synchronous and cheap (constructing the adapter must not load the
 * ~0.9 MB seed: on every launch after the first, startup only compares versions). `loadDataset`
 * loads and validates the seed lazily, maps it to domain values through the domain parse
 * functions, never rejects, and returns `exercises.seedAssetInvalid` (`details.reason`) for any
 * problem.
 */
export interface ExerciseSeedSource {
  readonly manifest: SeedManifest;
  loadDataset(): Promise<Result<SeedDataset, SeedSourceError>>;
}

export const ExerciseSeedSourceToken = createToken<ExerciseSeedSource>(
  'exercises.ExerciseSeedSource',
);

/**
 * Port: persistence of the built-in library for versioned seeding (S1-12). Separate from
 * `ExerciseWriter` (different consumer; built-ins are never written by the CRUD use cases).
 */
export interface BuiltInLibraryStore {
  /** The seed version applied last, or `null` on a fresh database. */
  readSeedVersion(): Promise<Result<number | null, ExerciseStorageError>>;
  /** Every stored built-in, archived ones included (update in place by `sourceKey`). */
  listBuiltIns(): Promise<Result<readonly BuiltInExercise[], ExerciseStorageError>>;
  /**
   * Applies the plan and records `plan.seedVersion` in **one transaction**: on any failure nothing
   * is written (an interrupted run leaves the previous state; the next launch retries).
   * Never touches custom exercises or user-defined vocabulary rows.
   */
  applySeed(plan: LibrarySeedPlan): Promise<Result<void, ExerciseStorageError>>;
}

export const BuiltInLibraryStoreToken = createToken<BuiltInLibraryStore>(
  'exercises.BuiltInLibraryStore',
);
