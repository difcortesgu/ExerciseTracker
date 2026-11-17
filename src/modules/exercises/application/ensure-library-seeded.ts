import { createToken } from '@shared/application/di/token';
import type { IdGenerator } from '@shared/application/id-generator';
import type { Logger } from '@shared/application/logger';
import { describeCause } from '@shared/domain/describe-cause';
import { domainError, type DomainError } from '@shared/domain/domain-error';
import { err, ok, type Result } from '@shared/domain/result';

import { planLibrarySeed } from '../domain/library-seed';

import type { ExerciseStorageError } from './exercise-repository';
import type { LibrarySeedError } from './library-errors';
import { nextExerciseId } from './library-use-case-support';
import type { BuiltInLibraryStore, ExerciseSeedSource } from './library-seed-ports';

/** What a seeding run did (logged; S1-12). */
export type LibrarySeedReport =
  /** The stored seed version equals the asset's: nothing was read or written. */
  | { readonly kind: 'upToDate'; readonly seedVersion: number }
  /** The stored version is higher (downgrade, branch switch): nothing was changed. */
  | {
      readonly kind: 'storedVersionNewer';
      readonly storedVersion: number;
      readonly assetVersion: number;
    }
  | {
      readonly kind: 'applied';
      readonly fromVersion: number | null;
      readonly toVersion: number;
      readonly inserted: number;
      readonly updated: number;
      readonly archived: number;
    };

/**
 * Use case: makes sure the bundled built-in library is stored at the asset's seed version
 * (S1-12, S1-13, ADR-004 "Seeding").
 *
 * - Compares `manifest.seedVersion` with the stored version first; only when lower (or none) does
 *   it load the seed, plan (`planLibrarySeed`) and apply it in one transaction.
 * - **Memoizing proxy with retry:** the first call starts a run; later calls return the same
 *   promise while it runs or after it succeeded; after a failed run, the next call starts a new run
 *   (the Exercises tab's Retry = call again). One instance per container (singleton).
 * - Never rejects; every failure is logged through `Logger` with its code and returned as `err`.
 * - Started by the bootstrap sequence as a background startup task (not awaited, so the tabs
 *   appear first), and awaited by every library use case (so they never see a partial library).
 *
 * Implemented by `createEnsureLibrarySeeded` below.
 */
export type EnsureLibrarySeeded = () => Promise<Result<LibrarySeedReport, LibrarySeedError>>;

export const EnsureLibrarySeededToken = createToken<EnsureLibrarySeeded>(
  'exercises.EnsureLibrarySeeded',
);

export interface EnsureLibrarySeededDependencies {
  readonly seedSource: ExerciseSeedSource;
  readonly store: BuiltInLibraryStore;
  readonly idGenerator: IdGenerator;
  readonly logger: Logger;
}

type SeedOutcome = Result<LibrarySeedReport, LibrarySeedError>;

function seedFailed(cause: string): DomainError<'exercises.seedFailed'> {
  return domainError('exercises.seedFailed', 'The built-in exercise library could not be stored.', {
    cause,
  });
}

const storeFailed = (error: ExerciseStorageError) => err(seedFailed(JSON.stringify(error)));

/** One seeding run: compare versions, then load, plan and apply only when the store is behind. */
async function seed(deps: EnsureLibrarySeededDependencies): Promise<SeedOutcome> {
  const assetVersion = deps.seedSource.manifest.seedVersion;
  const stored = await deps.store.readSeedVersion();
  if (!stored.ok) return storeFailed(stored.error);
  if (stored.value === assetVersion) return ok({ kind: 'upToDate', seedVersion: assetVersion });
  if (stored.value !== null && stored.value > assetVersion) {
    return ok({ kind: 'storedVersionNewer', storedVersion: stored.value, assetVersion });
  }
  const dataset = await deps.seedSource.loadDataset();
  if (!dataset.ok) return dataset;
  const existing = await deps.store.listBuiltIns();
  if (!existing.ok) return storeFailed(existing.error);
  const plan = planLibrarySeed({
    seedVersion: dataset.value.seedVersion,
    existing: existing.value,
    seed: dataset.value.exercises,
    vocabulary: dataset.value.vocabulary,
    newId: () => nextExerciseId(deps.idGenerator),
  });
  const applied = await deps.store.applySeed(plan);
  if (!applied.ok) return storeFailed(applied.error);
  return ok({
    kind: 'applied',
    fromVersion: stored.value,
    toVersion: plan.seedVersion,
    inserted: plan.insert.length,
    updated: plan.update.length,
    archived: plan.archive.length,
  });
}

/** A run that never rejects and logs its outcome. */
async function seedAndLog(deps: EnsureLibrarySeededDependencies): Promise<SeedOutcome> {
  let outcome: SeedOutcome;
  try {
    outcome = await seed(deps);
  } catch (cause) {
    outcome = err(seedFailed(describeCause(cause)));
  }
  if (outcome.ok) deps.logger.info('Exercise library ready', { ...outcome.value });
  else {
    deps.logger.error('The exercise library could not be prepared.', {
      code: outcome.error.code,
      details: outcome.error.details,
    });
  }
  return outcome;
}

/**
 * **Memoizing proxy with retry** around one seeding run: concurrent and later calls share the
 * running or successful run; a failed run is forgotten so the next call (Retry) starts a new one.
 */
export function createEnsureLibrarySeeded(
  deps: EnsureLibrarySeededDependencies,
): EnsureLibrarySeeded {
  let current: Promise<SeedOutcome> | null = null;
  return () => {
    if (current !== null) return current;
    const run = seedAndLog(deps).then((outcome) => {
      if (!outcome.ok) current = null;
      return outcome;
    });
    current = run;
    return run;
  };
}
