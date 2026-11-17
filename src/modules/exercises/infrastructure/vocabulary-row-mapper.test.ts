import { aVocabularyValue } from '@test/builders/exercise.builder';

import { vocabularyValueFromRow, vocabularyValueToRow } from './vocabulary-row-mapper';

describe('vocabulary row mapper (Data Mapper, ADR-004 §2)', () => {
  it.each([
    ['a built-in value', aVocabularyValue().ofKind('muscle').labelled('Lower back').build()],
    ['a user-defined value', aVocabularyValue().labelled('Sandbag').custom().build()],
    ['a category', aVocabularyValue().ofKind('category').labelled('Core').build()],
  ])('round-trips %s', (_case, value) => {
    expect(vocabularyValueFromRow(vocabularyValueToRow(value))).toEqual({ ok: true, value });
  });

  it('writes the key, label, kind and origin as columns', () => {
    expect(vocabularyValueToRow(aVocabularyValue().labelled('E-Z bar').custom().build())).toEqual({
      kind: 'equipment',
      key: 'e-z bar',
      origin: 'custom',
      label: 'E-Z bar',
    });
  });

  it.each([
    ['an unknown kind', { kind: 'level' }, /kind/],
    ['an unknown origin', { origin: 'imported' }, /origin/],
    ['a key that is not a comparison key', { key: 'Sandbag' }, /key/],
    ['a blank label', { label: '' }, /label/],
  ])('rejects a row with %s', (_case, overrides, field) => {
    const row = { kind: 'equipment', key: 'sandbag', origin: 'custom', label: 'Sandbag' };

    expect(vocabularyValueFromRow({ ...row, ...overrides })).toEqual({
      ok: false,
      error: expect.stringMatching(field) as unknown,
    });
  });
});
