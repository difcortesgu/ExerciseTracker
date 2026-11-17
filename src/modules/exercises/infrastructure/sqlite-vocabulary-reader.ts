import { asc } from 'drizzle-orm';

import type { SqliteDatabase } from '@shared/infrastructure/db/sqlite-database';

import type { VocabularyReader } from '../application/exercise-repository';
import type { VocabularyValue } from '../domain/vocabulary';

import { exerciseVocabularyValues } from './exercises.schema';
import { decodeRows, runStorage, type Stored } from './sqlite-storage';
import { vocabularyValueFromRow } from './vocabulary-row-mapper';

/** Adapter (Repository): `VocabularyReader` on SQLite, every stored value unmerged (S1-29). */
export class SqliteVocabularyReader implements VocabularyReader {
  constructor(private readonly database: SqliteDatabase) {}

  listValues(): Stored<readonly VocabularyValue[]> {
    return runStorage(() =>
      decodeRows(
        this.database
          .select()
          .from(exerciseVocabularyValues)
          .orderBy(
            asc(exerciseVocabularyValues.kind),
            asc(exerciseVocabularyValues.key),
            asc(exerciseVocabularyValues.origin),
          )
          .all(),
        vocabularyValueFromRow,
      ),
    );
  }
}
