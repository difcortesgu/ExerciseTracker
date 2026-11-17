import type { SeedDataset } from '@modules/exercises/application/library-seed-ports';
import type { BuiltInExerciseData } from '@modules/exercises/domain/exercise';
import type { VocabularyKind } from '@modules/exercises/domain/vocabulary';

/**
 * Builders of the bundled seed files in their **JSON** shape (`assets/exercise-db/manifest.json`
 * and `exercises.json`, written by tooling/exercise-db), so seed-source tests can arrange any
 * content without the real 0.9 MB asset.
 */

export const SEED_FORMAT_VERSION = 1;

const KINDS: readonly VocabularyKind[] = ['category', 'muscle', 'equipment'];

/** A `manifest.json` like the generated one; fields can be overridden (or broken) per test. */
export function aSeedManifestJson(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    formatVersion: SEED_FORMAT_VERSION,
    seedVersion: 3,
    contentHash: 'sha256:0000',
    source: {
      name: 'free-exercise-db',
      repositoryUrl: 'https://github.com/yuhonas/free-exercise-db',
      commit: 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5',
      licence: { name: 'The Unlicense (public domain)', url: 'https://unlicense.org/' },
    },
    imageBaseUrl: 'https://images.example/exercises/',
    counts: { exercises: 2, images: 4, imageBytes: 226_000 },
    ...overrides,
  };
}

/** One exercise record as the converter writes it. */
export function seedExerciseJson(data: BuiltInExerciseData): Readonly<Record<string, unknown>> {
  return {
    key: data.sourceKey,
    name: data.name,
    category: data.category,
    equipment: data.equipment,
    level: data.level,
    force: data.force,
    mechanic: data.mechanic,
    primaryMuscles: data.primaryMuscles,
    secondaryMuscles: data.secondaryMuscles,
    instructions: data.instructions,
    images: data.images.map(({ path, sizeBytes }) => ({ path, sizeBytes })),
  };
}

/** An `exercises.json` holding this content (vocabulary grouped by kind, order kept). */
export function aSeedAssetJson(
  content: Omit<SeedDataset, 'seedVersion'>,
  seedVersion: number,
): Readonly<Record<string, unknown>> {
  const vocabulary = Object.fromEntries(
    KINDS.map((kind) => [
      kind,
      content.vocabulary
        .filter((value) => value.kind === kind)
        .map(({ key, label }) => ({ key, label })),
    ]),
  );
  return {
    formatVersion: SEED_FORMAT_VERSION,
    seedVersion,
    vocabulary,
    exercises: content.exercises.map(seedExerciseJson),
  };
}
