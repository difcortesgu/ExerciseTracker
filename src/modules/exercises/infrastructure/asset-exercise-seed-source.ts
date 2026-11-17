import bundledManifest from '@assets/exercise-db/manifest.json';
import { describeCause } from '@shared/domain/describe-cause';
import { domainError } from '@shared/domain/domain-error';
import { err, mapErr, type Result } from '@shared/domain/result';

import type {
  ExerciseSeedSource,
  SeedDataset,
  SeedManifest,
  SeedSourceError,
} from '../application/library-seed-ports';

import { decodeSeedDataset, decodeSeedManifest } from './seed-asset-mapper';

export interface AssetExerciseSeedSourceOptions {
  /** The parsed `manifest.json` (small; read on every launch). */
  readonly manifest: unknown;
  /** Loads the parsed `exercises.json` lazily (~0.9 MB; only when seeding is needed). */
  readonly loadSeed: () => Promise<unknown>;
}

function seedAssetInvalid(reason: string): SeedSourceError {
  return domainError('exercises.seedAssetInvalid', 'The bundled exercise library is invalid.', {
    reason,
  });
}

/**
 * Adapter: `ExerciseSeedSource` over the bundled free-exercise-db seed (S1-11, S1-12, ADR-004 §3).
 * The only code that reads `assets/exercise-db/` (lint-enforced). The manifest is validated at
 * construction — a broken one is a broken build artefact, so construction throws (programmer
 * error; the composition-root test constructs it, so CI fails). The seed is loaded and validated
 * only in `loadDataset`, which never rejects.
 */
export class AssetExerciseSeedSource implements ExerciseSeedSource {
  readonly manifest: SeedManifest;
  private readonly loadSeed: () => Promise<unknown>;

  constructor(options: AssetExerciseSeedSourceOptions) {
    const manifest = decodeSeedManifest(options.manifest);
    if (!manifest.ok) {
      throw new Error(`The bundled exercise seed manifest is invalid: ${manifest.error}`);
    }
    this.manifest = manifest.value;
    this.loadSeed = options.loadSeed;
  }

  async loadDataset(): Promise<Result<SeedDataset, SeedSourceError>> {
    let raw: unknown;
    try {
      raw = await this.loadSeed();
    } catch (cause) {
      return err(seedAssetInvalid(describeCause(cause)));
    }
    return mapErr(decodeSeedDataset(raw, this.manifest), seedAssetInvalid);
  }
}

/**
 * The seed source over the real bundled files: the manifest is imported statically (642 bytes);
 * the seed is `require`d inside the loader (ADR-004 §3), so it is evaluated only when seeding
 * runs and later launches never parse the 0.9 MB seed. `require` also keeps the seed's literal
 * type out of the type checker; its content is validated by the mapper instead.
 */
export function createBundledExerciseSeedSource(): AssetExerciseSeedSource {
  return new AssetExerciseSeedSource({
    manifest: bundledManifest,
    loadSeed: () => {
      const seed: unknown = require('@assets/exercise-db/exercises.json');
      return Promise.resolve(seed);
    },
  });
}
