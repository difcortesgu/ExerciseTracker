import { SqliteDatabaseMigrator } from '@shared/infrastructure/db/sqlite-database-migrator';

import { createTestDatabase } from '../../support/sqlite-test-database';
import { unwrap } from '../../support/unwrap';

import { InMemorySampleNoteRepository } from './in-memory-sample-note-repository';
import { describeSampleNoteRepositoryContract } from './sample-note-repository.contract';
import {
  SAMPLE_NOTE_MIGRATIONS,
  SqliteSampleNoteRepository,
} from './sqlite-sample-note-repository';

describeSampleNoteRepositoryContract('InMemorySampleNoteRepository', () => {
  return new InMemorySampleNoteRepository();
});

describeSampleNoteRepositoryContract('SqliteSampleNoteRepository', {
  create: async () => {
    const { database, close } = createTestDatabase();
    const migrator = new SqliteDatabaseMigrator({
      openDatabase: () => database,
      migrations: SAMPLE_NOTE_MIGRATIONS,
    });
    unwrap(await migrator.migrate());
    return Object.assign(new SqliteSampleNoteRepository(database), { close });
  },
  dispose: (fixture) => fixture.close(),
});
