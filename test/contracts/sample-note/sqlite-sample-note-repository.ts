import { asc, eq } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { Migration } from '@shared/infrastructure/db/migration';
import type { SqliteDatabase } from '@shared/infrastructure/db/sqlite-database';

import { unwrap } from '../../support/unwrap';

import {
  parseSampleNoteId,
  type SampleNote,
  type SampleNoteId,
  type SampleNoteRepository,
} from './sample-note';

const sampleNotes = sqliteTable('sample_notes', {
  id: text('id').primaryKey(),
  body: text('body').notNull(),
});

type SampleNoteRow = typeof sampleNotes.$inferSelect;

/** Hand-written equivalent of a drizzle-kit migration for the table above. */
export const SAMPLE_NOTE_MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: '0000_create_sample_notes',
    statements: [
      'CREATE TABLE `sample_notes` (`id` text PRIMARY KEY NOT NULL, `body` text NOT NULL)',
    ],
  },
];

/** Data Mapper: rows and domain objects are mapped explicitly; Drizzle types stay in here. */
function toSampleNote(row: SampleNoteRow): SampleNote {
  return { id: unwrap(parseSampleNoteId(row.id)), body: row.body };
}

/** SQLite adapter of `SampleNoteRepository`, written against the shared `SqliteDatabase` type. */
export class SqliteSampleNoteRepository implements SampleNoteRepository {
  constructor(private readonly database: SqliteDatabase) {}

  async save(note: SampleNote): Promise<void> {
    this.database
      .insert(sampleNotes)
      .values({ id: note.id, body: note.body })
      .onConflictDoUpdate({ target: sampleNotes.id, set: { body: note.body } })
      .run();
  }

  async findById(id: SampleNoteId): Promise<SampleNote | undefined> {
    const row = this.database.select().from(sampleNotes).where(eq(sampleNotes.id, id)).get();
    return row === undefined ? undefined : toSampleNote(row);
  }

  async list(): Promise<readonly SampleNote[]> {
    return this.database
      .select()
      .from(sampleNotes)
      .orderBy(asc(sampleNotes.id))
      .all()
      .map(toSampleNote);
  }
}
