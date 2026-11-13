import { idFactory, type Id } from '@shared/domain/id';

/**
 * Test-only sample aggregate and repository port (S0-20). They exist to prove the contract
 * harness against a real SQLite adapter before Sprint 1 adds the first real repository, and are
 * never shipped in `src/`.
 */
export type SampleNoteId = Id<'SampleNoteId'>;
export const parseSampleNoteId = idFactory('SampleNoteId');

export interface SampleNote {
  readonly id: SampleNoteId;
  readonly body: string;
}

/** Repository pattern: persistence behind a port, so use cases never see storage details. */
export interface SampleNoteRepository {
  save(note: SampleNote): Promise<void>;
  findById(id: SampleNoteId): Promise<SampleNote | undefined>;
  /** All notes, ordered by id. */
  list(): Promise<readonly SampleNote[]>;
}
