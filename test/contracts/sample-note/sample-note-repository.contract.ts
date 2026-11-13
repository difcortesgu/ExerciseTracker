import { unwrap } from '../../support/unwrap';
import { defineContract } from '../contract-harness';

import { parseSampleNoteId, type SampleNote, type SampleNoteRepository } from './sample-note';

const note = (id: string, body: string): SampleNote => ({
  id: unwrap(parseSampleNoteId(id)),
  body,
});

/**
 * Contract for the test-only `SampleNoteRepository` (S0-20). It shows the shape every repository
 * contract follows; Sprint 1 adds `ExerciseRepository` the same way without touching the harness.
 */
export const describeSampleNoteRepositoryContract = defineContract<SampleNoteRepository>(
  'SampleNoteRepository',
  (repository) => {
    it('starts empty for every case', async () => {
      expect(await repository().list()).toEqual([]);
      await repository().save(note('note-1', 'Leaks into the next case if not fresh'));
    });

    it('starts empty again in the next case', async () => {
      expect(await repository().list()).toEqual([]);
    });

    it('finds a saved note by id', async () => {
      await repository().save(note('note-1', 'Squats felt heavy'));

      expect(await repository().findById(note('note-1', '').id)).toEqual(
        note('note-1', 'Squats felt heavy'),
      );
    });

    it('finds nothing for an unknown id', async () => {
      expect(await repository().findById(note('missing', '').id)).toBeUndefined();
    });

    it('replaces a note saved again with the same id', async () => {
      await repository().save(note('note-1', 'First draft'));
      await repository().save(note('note-1', 'Final text'));

      expect(await repository().list()).toEqual([note('note-1', 'Final text')]);
    });

    it('lists all notes ordered by id', async () => {
      await repository().save(note('note-b', 'Second'));
      await repository().save(note('note-a', 'First'));

      expect(await repository().list()).toEqual([
        note('note-a', 'First'),
        note('note-b', 'Second'),
      ]);
    });

    it('orders ids by their code points, as SQLite does', async () => {
      await repository().save(note('note-a', 'Lower case'));
      await repository().save(note('Note-B', 'Upper case'));

      expect((await repository().list()).map(({ id }) => id)).toEqual(['Note-B', 'note-a']);
    });
  },
);
