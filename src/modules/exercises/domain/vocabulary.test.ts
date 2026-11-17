import * as fc from 'fast-check';

import { aVocabularyValue, vocabularyKeyOf } from '@test/builders/exercise.builder';
import { unwrap, unwrapErr } from '@test/support/unwrap';

import {
  mergeVocabulary,
  resolveVocabularySelection,
  VOCABULARY_VALUE_MAX_LENGTH,
  type VocabularyKind,
  type VocabularyValue,
} from './vocabulary';

const builtIn = (kind: VocabularyKind, label: string): VocabularyValue =>
  aVocabularyValue().ofKind(kind).labelled(label).build();
const custom = (kind: VocabularyKind, label: string): VocabularyValue =>
  aVocabularyValue().ofKind(kind).labelled(label).custom().build();

const labelsOf = (values: readonly VocabularyValue[]) => values.map(({ label }) => label);

describe('VOCABULARY_VALUE_MAX_LENGTH', () => {
  it('is 40 characters (S1-29)', () => {
    expect(VOCABULARY_VALUE_MAX_LENGTH).toBe(40);
  });
});

describe('mergeVocabulary', () => {
  it('groups values by kind, each kind alphabetical by key', () => {
    const vocabulary = mergeVocabulary([
      builtIn('equipment', 'Kettlebells'),
      builtIn('muscle', 'Quadriceps'),
      builtIn('equipment', 'Barbell'),
      builtIn('category', 'Strength'),
      builtIn('muscle', 'Biceps'),
    ]);

    expect(labelsOf(vocabulary.category)).toEqual(['Strength']);
    expect(labelsOf(vocabulary.muscle)).toEqual(['Biceps', 'Quadriceps']);
    expect(labelsOf(vocabulary.equipment)).toEqual(['Barbell', 'Kettlebells']);
  });

  it('sorts case- and accent-insensitively, user-defined values next to built-in ones', () => {
    const vocabulary = mergeVocabulary([
      custom('equipment', 'sandbag'),
      builtIn('equipment', 'Barbell'),
      custom('equipment', 'Ábacus'),
      builtIn('equipment', 'Cable'),
    ]);

    expect(labelsOf(vocabulary.equipment)).toEqual(['Ábacus', 'Barbell', 'Cable', 'sandbag']);
  });

  it('shows a key once, with the built-in label and origin winning over a user-defined value', () => {
    const vocabulary = mergeVocabulary([
      custom('equipment', 'SANDBAG'),
      builtIn('equipment', 'Sandbag'),
    ]);

    expect(vocabulary.equipment).toEqual([builtIn('equipment', 'Sandbag')]);
  });

  it('breaks a tie between two values of the same key and origin by label (stable result)', () => {
    const vocabulary = mergeVocabulary([
      custom('equipment', 'sandbag'),
      custom('equipment', 'Sandbag'),
    ]);

    expect(labelsOf(vocabulary.equipment)).toEqual(['Sandbag']);
  });

  it('keeps the same text in different kinds apart (vocabularies are independent)', () => {
    const vocabulary = mergeVocabulary([custom('muscle', 'Core'), custom('category', 'Core')]);

    expect(labelsOf(vocabulary.muscle)).toEqual(['Core']);
    expect(labelsOf(vocabulary.category)).toEqual(['Core']);
    expect(vocabulary.equipment).toEqual([]);
  });

  it('returns frozen lists', () => {
    const vocabulary = mergeVocabulary([builtIn('muscle', 'Biceps')]);

    expect(Object.isFrozen(vocabulary)).toBe(true);
    expect(Object.isFrozen(vocabulary.muscle)).toBe(true);
  });

  it('keeps one entry per key, never invents values, and is order-independent', () => {
    const anyValue = fc
      .record({
        kind: fc.constantFrom<VocabularyKind>('category', 'muscle', 'equipment'),
        label: fc.constantFrom('Barbell', 'barbell', 'Sandbag', 'Core', 'Cöre', 'Band'),
        isCustom: fc.boolean(),
      })
      .map(({ kind, label, isCustom }) => (isCustom ? custom(kind, label) : builtIn(kind, label)));

    fc.assert(
      fc.property(fc.array(anyValue), (values) => {
        const merged = mergeVocabulary(values);
        const reversed = mergeVocabulary([...values].reverse());

        (['category', 'muscle', 'equipment'] as const).forEach((kind) => {
          const mergedKeys = merged[kind].map(({ key }) => key);
          expect(new Set(mergedKeys).size).toBe(mergedKeys.length);
          expect(new Set(mergedKeys)).toEqual(
            new Set(values.filter((value) => value.kind === kind).map(({ key }) => key)),
          );
          merged[kind].forEach((value) => expect(values).toContainEqual(value));
          expect(reversed[kind]).toEqual(merged[kind]);
        });
      }),
    );
  });
});

describe('resolveVocabularySelection', () => {
  const vocabulary = mergeVocabulary([
    builtIn('category', 'Strength'),
    builtIn('muscle', 'Quadriceps'),
    builtIn('equipment', 'Barbell'),
    custom('equipment', 'Sandbag'),
  ]);

  describe('an existing value', () => {
    it('resolves a known key to its value, nothing new', () => {
      const resolved = resolveVocabularySelection(vocabulary, 'equipment', {
        source: 'existing',
        key: vocabularyKeyOf('Sandbag'),
      });

      expect(unwrap(resolved)).toEqual({ value: custom('equipment', 'Sandbag'), isNew: false });
    });

    it.each([
      ['category', 'exercises.unknownCategory'],
      ['muscle', 'exercises.unknownMuscle'],
      ['equipment', 'exercises.unknownEquipment'],
    ] as const)('rejects an unknown %s key with %s', (kind, code) => {
      const key = vocabularyKeyOf('Unicorn');

      const error = unwrapErr(
        resolveVocabularySelection(vocabulary, kind, { source: 'existing', key }),
      );

      expect(error).toMatchObject({ code, details: { key } });
    });

    it('does not find a key of another kind', () => {
      const error = unwrapErr(
        resolveVocabularySelection(vocabulary, 'muscle', {
          source: 'existing',
          key: vocabularyKeyOf('Barbell'),
        }),
      );

      expect(error.code).toBe('exercises.unknownMuscle');
    });
  });

  describe('a new ("Add your own") value', () => {
    it('creates a new user-defined value with the normalised label', () => {
      const resolved = resolveVocabularySelection(vocabulary, 'equipment', {
        source: 'new',
        label: '  Weight   vest ',
      });

      expect(unwrap(resolved)).toEqual({ value: custom('equipment', 'Weight vest'), isNew: true });
    });

    it.each(['barbell', ' BÁRBELL '])('reuses the built-in value for %p', (label) => {
      const resolved = resolveVocabularySelection(vocabulary, 'equipment', {
        source: 'new',
        label,
      });

      expect(unwrap(resolved)).toEqual({ value: builtIn('equipment', 'Barbell'), isNew: false });
    });

    it('reuses an existing user-defined value instead of creating a duplicate', () => {
      const resolved = resolveVocabularySelection(vocabulary, 'equipment', {
        source: 'new',
        label: 'sandbag',
      });

      expect(unwrap(resolved)).toEqual({ value: custom('equipment', 'Sandbag'), isNew: false });
    });

    it('creates the same text as a new value in another kind', () => {
      const resolved = resolveVocabularySelection(vocabulary, 'muscle', {
        source: 'new',
        label: 'Barbell',
      });

      expect(unwrap(resolved)).toEqual({ value: custom('muscle', 'Barbell'), isNew: true });
    });

    it.each(['', '   ', '\t\n'])('rejects the blank label %p', (label) => {
      const error = unwrapErr(
        resolveVocabularySelection(vocabulary, 'equipment', { source: 'new', label }),
      );

      expect(error).toEqual({
        code: 'exercises.vocabularyValueRequired',
        message: expect.stringMatching(/\S/) as unknown,
      });
    });

    it('accepts 40 characters and rejects 41 (after normalisation)', () => {
      const atLimit = 'a'.repeat(VOCABULARY_VALUE_MAX_LENGTH);
      const tooLong = `${atLimit}b`;

      expect(
        resolveVocabularySelection(vocabulary, 'muscle', { source: 'new', label: ` ${atLimit} ` }),
      ).toMatchObject({ ok: true });
      expect(
        unwrapErr(
          resolveVocabularySelection(vocabulary, 'muscle', { source: 'new', label: tooLong }),
        ),
      ).toMatchObject({ code: 'exercises.vocabularyValueTooLong', details: { maximum: 40 } });
    });

    it('counts characters, not UTF-16 units', () => {
      const label = '💪'.repeat(VOCABULARY_VALUE_MAX_LENGTH);

      expect(
        resolveVocabularySelection(vocabulary, 'muscle', { source: 'new', label }),
      ).toMatchObject({ ok: true });
    });
  });
});
