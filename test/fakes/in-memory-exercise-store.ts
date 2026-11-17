import type {
  BuiltInImageCatalog,
  ExerciseReader,
  ExerciseStorageError,
  ExerciseWriter,
  FindExerciseOptions,
  VocabularyReader,
} from '@modules/exercises/application/exercise-repository';
import type { BuiltInLibraryStore } from '@modules/exercises/application/library-seed-ports';
import { exerciseStorageFailed } from '@modules/exercises/application/storage-failure';
import { comparisonKey, type ComparisonKey } from '@modules/exercises/domain/comparison-key';
import type {
  BuiltInExercise,
  BuiltInImage,
  CustomExercise,
  Exercise,
  PhotoFileName,
} from '@modules/exercises/domain/exercise';
import {
  summariseExercise,
  type ExerciseSummary,
} from '@modules/exercises/domain/exercise-summary';
import type { LibrarySeedPlan } from '@modules/exercises/domain/library-seed';
import type { VocabularyValue } from '@modules/exercises/domain/vocabulary';
import type { ExerciseId } from '@shared/domain/ids';
import { err, ok, type Result } from '@shared/domain/result';

type Stored<T> = Promise<Result<T, ExerciseStorageError>>;

interface InitialState {
  readonly exercises?: readonly Exercise[];
  readonly vocabulary?: readonly VocabularyValue[];
  readonly seedVersion?: number | null;
}

const identityOf = ({ kind, key, origin }: VocabularyValue): string => `${kind}|${key}|${origin}`;

/**
 * In-memory fake of every exercises repository port (Repository pattern, S1-14): `ExerciseReader`,
 * `ExerciseWriter`, `VocabularyReader`, `BuiltInImageCatalog` and `BuiltInLibraryStore` over one
 * store, like the SQLite adapters over one database. Passes the same contract suites. Test helpers:
 * arranged initial state, `failWith` / `recover` and `writeCount`.
 */
export class InMemoryExerciseStore
  implements
    ExerciseReader,
    ExerciseWriter,
    VocabularyReader,
    BuiltInImageCatalog,
    BuiltInLibraryStore
{
  private exercises = new Map<ExerciseId, Exercise>();
  private vocabulary = new Map<string, VocabularyValue>();
  private seedVersion: number | null;
  private failure: unknown = null;
  private writes = 0;

  constructor(initial: InitialState = {}) {
    (initial.exercises ?? []).forEach((exercise) => this.exercises.set(exercise.id, exercise));
    (initial.vocabulary ?? []).forEach((value) => this.vocabulary.set(identityOf(value), value));
    this.seedVersion = initial.seedVersion ?? null;
  }

  get writeCount(): number {
    return this.writes;
  }

  /** Every stored exercise, archived included, in insertion order. */
  allExercises(): readonly Exercise[] {
    return [...this.exercises.values()];
  }

  failWith(cause: unknown): void {
    this.failure = cause;
  }

  recover(): void {
    this.failure = null;
  }

  listActiveSummaries(): Stored<readonly ExerciseSummary[]> {
    return this.read(() => this.active().map(summariseExercise));
  }

  findById(id: ExerciseId, options?: FindExerciseOptions): Stored<Exercise | null> {
    return this.read(() => {
      const exercise = this.exercises.get(id);
      if (exercise === undefined) return null;
      return exercise.archived && options?.includeArchived !== true ? null : exercise;
    });
  }

  findActiveByNameKey(
    nameKey: ComparisonKey,
    excluding?: ExerciseId,
  ): Stored<ExerciseSummary | null> {
    return this.read(() => {
      const match = this.active().find(
        (exercise) => exercise.id !== excluding && comparisonKey(exercise.name) === nameKey,
      );
      return match === undefined ? null : summariseExercise(match);
    });
  }

  listActivePhotoFileNames(): Stored<ReadonlySet<PhotoFileName>> {
    return this.read(
      () =>
        new Set(
          this.active()
            .filter((exercise): exercise is CustomExercise => exercise.origin === 'custom')
            .flatMap((exercise) => exercise.images.map(({ fileName }) => fileName)),
        ),
    );
  }

  saveCustom(
    exercise: CustomExercise,
    newVocabularyValues: readonly VocabularyValue[],
  ): Stored<void> {
    return this.write(() => {
      this.exercises.set(exercise.id, exercise);
      newVocabularyValues
        .filter((value) => !this.vocabulary.has(identityOf(value)))
        .forEach((value) => this.vocabulary.set(identityOf(value), value));
    });
  }

  listValues(): Stored<readonly VocabularyValue[]> {
    return this.read(() => [...this.vocabulary.values()]);
  }

  listActiveBuiltInImages(): Stored<readonly BuiltInImage[]> {
    return this.read(() => {
      const byPath = new Map<string, BuiltInImage>();
      this.activeBuiltIns()
        .flatMap((exercise) => exercise.images)
        .forEach((image) => byPath.set(image.path, image));
      return [...byPath.values()].sort((first, second) => (first.path < second.path ? -1 : 1));
    });
  }

  readSeedVersion(): Stored<number | null> {
    return this.read(() => this.seedVersion);
  }

  listBuiltIns(): Stored<readonly BuiltInExercise[]> {
    return this.read(() => this.builtIns());
  }

  /** All or nothing, like the SQLite transaction: a conflicting insert writes nothing. */
  applySeed(plan: LibrarySeedPlan): Stored<void> {
    return this.write(() => {
      this.rejectConflictingInserts(plan.insert);
      plan.insert.forEach((exercise) => this.exercises.set(exercise.id, exercise));
      plan.update
        .filter((exercise) => this.exercises.get(exercise.id)?.origin === 'builtIn')
        .forEach((exercise) => this.exercises.set(exercise.id, exercise));
      this.builtIns()
        .filter((exercise) => plan.archive.includes(exercise.id))
        .forEach((exercise) => this.exercises.set(exercise.id, { ...exercise, archived: true }));
      plan.vocabulary.forEach((value) => this.vocabulary.set(identityOf(value), value));
      this.seedVersion = plan.seedVersion;
    });
  }

  private rejectConflictingInserts(insert: readonly BuiltInExercise[]): void {
    const ids = new Set<string>(this.exercises.keys());
    const sourceKeys = new Set<string>(this.builtIns().map(({ sourceKey }) => sourceKey));
    insert.forEach(({ id, sourceKey }) => {
      if (ids.has(id) || sourceKeys.has(sourceKey)) {
        throw new Error(`UNIQUE constraint failed: exercises (${id}, ${sourceKey})`);
      }
      ids.add(id);
      sourceKeys.add(sourceKey);
    });
  }

  private active(): readonly Exercise[] {
    return this.allExercises().filter((exercise) => !exercise.archived);
  }

  private builtIns(): readonly BuiltInExercise[] {
    return this.allExercises().filter(
      (exercise): exercise is BuiltInExercise => exercise.origin === 'builtIn',
    );
  }

  private activeBuiltIns(): readonly BuiltInExercise[] {
    return this.builtIns().filter((exercise) => !exercise.archived);
  }

  private read<T>(query: () => T): Stored<T> {
    return Promise.resolve(
      this.failure === null ? ok(query()) : err(exerciseStorageFailed(this.failure)),
    );
  }

  /** Applies the change to copies and commits them only if it completes (atomic). */
  private write(change: () => void): Stored<void> {
    if (this.failure !== null) return Promise.resolve(err(exerciseStorageFailed(this.failure)));
    const snapshot = {
      exercises: new Map(this.exercises),
      vocabulary: new Map(this.vocabulary),
      seedVersion: this.seedVersion,
    };
    try {
      change();
      this.writes += 1;
      return Promise.resolve(ok(undefined));
    } catch (cause) {
      this.exercises = snapshot.exercises;
      this.vocabulary = snapshot.vocabulary;
      this.seedVersion = snapshot.seedVersion;
      return Promise.resolve(err(exerciseStorageFailed(cause)));
    }
  }
}
