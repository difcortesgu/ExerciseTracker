import type { SampleNote, SampleNoteId, SampleNoteRepository } from './sample-note';

/** In-memory fake of `SampleNoteRepository`. */
export class InMemorySampleNoteRepository implements SampleNoteRepository {
  private readonly notes = new Map<SampleNoteId, SampleNote>();

  async save(note: SampleNote): Promise<void> {
    this.notes.set(note.id, note);
  }

  async findById(id: SampleNoteId): Promise<SampleNote | undefined> {
    return this.notes.get(id);
  }

  async list(): Promise<readonly SampleNote[]> {
    // Code-point order, like SQLite's default BINARY collation (not localeCompare).
    return [...this.notes.values()].sort((first, second) => (first.id < second.id ? -1 : 1));
  }
}
