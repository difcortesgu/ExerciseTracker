import { ok } from '@shared/domain/result';
import type { SqliteDatabase } from '@shared/infrastructure/db/sqlite-database';

import type { ExerciseWriter } from '../application/exercise-repository';
import type { CustomExercise } from '../domain/exercise';
import type { VocabularyValue } from '../domain/vocabulary';

import { exerciseToRow } from './exercise-row-mapper';
import { exercises, exerciseVocabularyValues } from './exercises.schema';
import { runStorage, type Stored } from './sqlite-storage';
import { vocabularyValueToRow } from './vocabulary-row-mapper';

/**
 * Adapter (Repository, Unit of Work in one method): `ExerciseWriter` on SQLite (S1-19 to S1-21,
 * S1-29). The exercise row (with a fresh `name_key`) and its new user-defined values are written in
 * **one transaction**; an existing value with the same `(kind, key, origin)` is left as it is.
 */
export class SqliteExerciseWriter implements ExerciseWriter {
  constructor(private readonly database: SqliteDatabase) {}

  saveCustom(
    exercise: CustomExercise,
    newVocabularyValues: readonly VocabularyValue[],
  ): Stored<void> {
    return runStorage(() => {
      const row = exerciseToRow(exercise);
      this.database.transaction((transaction) => {
        transaction
          .insert(exercises)
          .values(row)
          .onConflictDoUpdate({ target: exercises.id, set: row })
          .run();
        if (newVocabularyValues.length > 0) {
          transaction
            .insert(exerciseVocabularyValues)
            .values(newVocabularyValues.map(vocabularyValueToRow))
            .onConflictDoNothing()
            .run();
        }
      });
      return ok(undefined);
    });
  }
}
