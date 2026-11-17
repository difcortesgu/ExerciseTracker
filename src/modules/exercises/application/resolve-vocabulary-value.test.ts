import { domainError } from '@shared/domain/domain-error';
import { aVocabularyValue, vocabularyKeyOf } from '@test/builders/exercise.builder';
import { InMemoryExerciseStore } from '@test/fakes/in-memory-exercise-store';
import { RecordingLogger } from '@test/fakes/recording-logger';
import { failedSeeding, seededLibrary } from '@test/fakes/stub-ensure-library-seeded';
import { unwrap, unwrapErr } from '@test/support/unwrap';

import type { EnsureLibrarySeeded } from './ensure-library-seeded';
import { createResolveVocabularyValue } from './resolve-vocabulary-value';

const barbell = aVocabularyValue().ofKind('equipment').labelled('Barbell').build();
const sandbag = aVocabularyValue().ofKind('equipment').labelled('Sandbag').custom().build();

function setUp(ensureLibrarySeeded: EnsureLibrarySeeded = seededLibrary()) {
  const store = new InMemoryExerciseStore({ vocabulary: [barbell, sandbag] });
  const logger = new RecordingLogger();
  const resolveVocabularyValue = createResolveVocabularyValue({
    ensureLibrarySeeded,
    vocabularyReader: store,
    logger,
  });
  return { store, logger, resolveVocabularyValue };
}

describe('createResolveVocabularyValue (S1-29)', () => {
  it('selects the built-in value when the text equals it', async () => {
    const { resolveVocabularyValue } = setUp();

    expect(unwrap(await resolveVocabularyValue('equipment', '  bárbell '))).toEqual({
      option: { key: barbell.key, label: 'Barbell', isCustom: false },
      selection: { source: 'existing', key: barbell.key },
    });
  });

  it('selects the existing user-defined value when the text equals it', async () => {
    const { resolveVocabularyValue } = setUp();

    expect(unwrap(await resolveVocabularyValue('equipment', 'SANDBAG'))).toEqual({
      option: { key: sandbag.key, label: 'Sandbag', isCustom: true },
      selection: { source: 'existing', key: sandbag.key },
    });
  });

  it('returns a new custom option with a normalised label and persists nothing', async () => {
    const { resolveVocabularyValue, store } = setUp();

    expect(unwrap(await resolveVocabularyValue('equipment', '  Weight   vest '))).toEqual({
      option: { key: vocabularyKeyOf('Weight vest'), label: 'Weight vest', isCustom: true },
      selection: { source: 'new', label: 'Weight vest' },
    });
    expect(store.writeCount).toBe(0);
  });

  it('treats vocabularies independently', async () => {
    const { resolveVocabularyValue } = setUp();

    const resolved = unwrap(await resolveVocabularyValue('category', 'Sandbag'));

    expect(resolved.selection).toEqual({ source: 'new', label: 'Sandbag' });
  });

  it('rejects a blank value without logging a fault', async () => {
    const { resolveVocabularyValue, logger } = setUp();

    expect(unwrapErr(await resolveVocabularyValue('muscle', '   ')).code).toBe(
      'exercises.vocabularyValueRequired',
    );
    expect(logger.entries).toHaveLength(0);
  });

  it('rejects a value longer than 40 characters', async () => {
    const { resolveVocabularyValue } = setUp();

    expect(unwrapErr(await resolveVocabularyValue('muscle', 'x'.repeat(41))).code).toBe(
      'exercises.vocabularyValueTooLong',
    );
  });

  it('returns a seeding failure unchanged', async () => {
    const failure = domainError('exercises.seedFailed', 'Seeding failed.');
    const { resolveVocabularyValue } = setUp(failedSeeding(failure));

    expect(unwrapErr(await resolveVocabularyValue('equipment', 'Sandbag'))).toBe(failure);
  });

  it('returns and logs a storage failure', async () => {
    const { resolveVocabularyValue, store, logger } = setUp();
    store.failWith('disk');

    expect(unwrapErr(await resolveVocabularyValue('equipment', 'Sandbag')).code).toBe(
      'exercises.storageFailed',
    );
    expect(logger.entriesAt('warn')).toHaveLength(1);
  });
});
