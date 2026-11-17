import type {
  BuiltInImageCatalog,
  ExerciseReader,
  ExerciseWriter,
  VocabularyReader,
} from '@modules/exercises/application/exercise-repository';
import type { BuiltInLibraryStore } from '@modules/exercises/application/library-seed-ports';
import type { BuiltInExercise, CustomExercise } from '@modules/exercises/domain/exercise';
import type { LibrarySeedPlan } from '@modules/exercises/domain/library-seed';
import type { VocabularyValue } from '@modules/exercises/domain/vocabulary';

import { unwrap } from '../../support/unwrap';

/**
 * Every repository port of the exercises module over **one** store (S1-14), so the contract suites
 * can arrange data through the ports themselves (`applySeed`, `saveCustom`) and run unchanged against
 * the in-memory fake and the SQLite adapters (Liskov).
 */
export interface ExerciseStoreFixture {
  readonly reader: ExerciseReader;
  readonly writer: ExerciseWriter;
  readonly vocabularyReader: VocabularyReader;
  readonly catalog: BuiltInImageCatalog;
  readonly library: BuiltInLibraryStore;
  /** From now on every storage access fails (e.g. the database is closed). */
  breakStorage(): void;
}

export const aSeedPlan = (overrides: Partial<LibrarySeedPlan> = {}): LibrarySeedPlan => ({
  seedVersion: 1,
  insert: [],
  update: [],
  archive: [],
  vocabulary: [],
  ...overrides,
});

export async function seedBuiltIns(
  fixture: ExerciseStoreFixture,
  exercises: readonly BuiltInExercise[],
  vocabulary: readonly VocabularyValue[] = [],
): Promise<void> {
  unwrap(await fixture.library.applySeed(aSeedPlan({ insert: exercises, vocabulary })));
}

export async function saveCustoms(
  fixture: ExerciseStoreFixture,
  ...exercises: readonly CustomExercise[]
): Promise<void> {
  for (const exercise of exercises) {
    unwrap(await fixture.writer.saveCustom(exercise, []));
  }
}

/** What every storage failure looks like: `exercises.storageFailed` with a cause, never a rejection. */
export const STORAGE_FAILURE = {
  ok: false,
  error: { code: 'exercises.storageFailed', details: { cause: expect.any(String) as unknown } },
};
