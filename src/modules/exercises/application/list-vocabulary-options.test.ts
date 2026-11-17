import { domainError } from '@shared/domain/domain-error';
import { aVocabularyValue } from '@test/builders/exercise.builder';
import { InMemoryExerciseStore } from '@test/fakes/in-memory-exercise-store';
import { RecordingLogger } from '@test/fakes/recording-logger';
import { failedSeeding, seededLibrary } from '@test/fakes/stub-ensure-library-seeded';
import { unwrap, unwrapErr } from '@test/support/unwrap';

import type { EnsureLibrarySeeded } from './ensure-library-seeded';
import { createListVocabularyOptions } from './list-vocabulary-options';

const equipment = aVocabularyValue().ofKind('equipment');
const barbell = equipment.labelled('Barbell').build();
const sandbag = equipment.labelled('Sandbag').custom().build();
const sandbagBuiltIn = equipment.labelled('sandbag').build();
const ownBarbell = equipment.labelled('Bárbell').custom().build();
const core = aVocabularyValue().ofKind('muscle').labelled('Core').custom().build();

function setUp(ensureLibrarySeeded: EnsureLibrarySeeded = seededLibrary()) {
  const store = new InMemoryExerciseStore({
    vocabulary: [sandbag, barbell, core, sandbagBuiltIn, ownBarbell],
  });
  const logger = new RecordingLogger();
  const listVocabularyOptions = createListVocabularyOptions({
    ensureLibrarySeeded,
    vocabularyReader: store,
    logger,
  });
  return { store, logger, listVocabularyOptions };
}

describe('createListVocabularyOptions (S1-15, S1-29)', () => {
  it('lists built-in and user-defined values together, once per key, alphabetically', async () => {
    const { listVocabularyOptions } = setUp();

    const options = unwrap(await listVocabularyOptions());

    expect(options).toEqual({
      category: [],
      muscle: [{ key: core.key, label: 'Core', isCustom: true }],
      equipment: [
        { key: barbell.key, label: 'Barbell', isCustom: false },
        { key: sandbag.key, label: 'sandbag', isCustom: false },
      ],
    });
  });

  it('returns a seeding failure unchanged', async () => {
    const failure = domainError('exercises.seedFailed', 'Seeding failed.');
    const { listVocabularyOptions } = setUp(failedSeeding(failure));

    expect(unwrapErr(await listVocabularyOptions())).toBe(failure);
  });

  it('returns and logs a storage failure', async () => {
    const { listVocabularyOptions, store, logger } = setUp();
    store.failWith('disk');

    expect(unwrapErr(await listVocabularyOptions()).code).toBe('exercises.storageFailed');
    expect(logger.entriesAt('warn')).toHaveLength(1);
  });
});
