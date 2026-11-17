import { aBuiltInImage, aCustomPhoto, vocabularyKeyOf } from '@test/builders/exercise.builder';

import {
  decodeBuiltInImages,
  decodeExerciseId,
  decodeForce,
  decodeJson,
  decodeLevel,
  decodeMechanic,
  decodeNonNegativeInteger,
  decodePhotos,
  decodePositiveInteger,
  decodeSeedSourceKey,
  decodeText,
  decodeTextList,
  decodeTrackedMetrics,
  decodeVocabularyKey,
  decodeVocabularyKeys,
  decodeVocabularyKind,
  decodeVocabularyOrigin,
  isRecord,
  nullable,
} from './exercise-decoders';

const failed = { ok: false, error: expect.any(String) as unknown };

describe('exercise decoders (Data Mapper support for rows and the seed asset)', () => {
  describe('decodeJson', () => {
    it('parses JSON text', () => {
      expect(decodeJson('["a",1]')).toEqual({ ok: true, value: ['a', 1] });
    });

    it('describes text that is not JSON', () => {
      expect(decodeJson('[oops')).toEqual({
        ok: false,
        error: expect.stringMatching(/not valid JSON/) as unknown,
      });
    });
  });

  describe('isRecord', () => {
    it.each([
      [{}, true],
      [{ a: 1 }, true],
      [null, false],
      [[], false],
      ['text', false],
    ])('tells whether %p is a plain object', (raw, expected) => {
      expect(isRecord(raw)).toBe(expected);
    });
  });

  describe('decodeText', () => {
    it('accepts a non-blank string unchanged', () => {
      expect(decodeText('Barbell Squat')).toEqual({ ok: true, value: 'Barbell Squat' });
    });

    it.each([[''], ['   '], [3], [null]])('rejects %p', (raw) => {
      expect(decodeText(raw)).toEqual(failed);
    });
  });

  describe('decodeTextList', () => {
    it('keeps the order of the steps', () => {
      expect(decodeTextList(['Third', 'First'])).toEqual({ ok: true, value: ['Third', 'First'] });
    });

    it('accepts an empty list', () => {
      expect(decodeTextList([])).toEqual({ ok: true, value: [] });
    });

    it('names the position of an invalid item', () => {
      expect(decodeTextList(['ok', ' '])).toEqual({
        ok: false,
        error: expect.stringMatching(/\[1\]/) as unknown,
      });
    });

    it('rejects a value that is not a list', () => {
      expect(decodeTextList('step')).toEqual(failed);
    });
  });

  describe('decodeVocabularyKey', () => {
    it('accepts a comparison key', () => {
      expect(decodeVocabularyKey('body only')).toEqual({
        ok: true,
        value: vocabularyKeyOf('body only'),
      });
    });

    it.each([['Body only'], ['body  only'], [''], [1]])('rejects %p (not a key)', (raw) => {
      expect(decodeVocabularyKey(raw)).toEqual(failed);
    });

    it('decodes a list of keys in order', () => {
      expect(decodeVocabularyKeys(['triceps', 'chest'])).toEqual({
        ok: true,
        value: [vocabularyKeyOf('triceps'), vocabularyKeyOf('chest')],
      });
    });
  });

  describe('nullable', () => {
    it('accepts null and otherwise delegates', () => {
      const decodeEquipment = nullable(decodeVocabularyKey);

      expect(decodeEquipment(null)).toEqual({ ok: true, value: null });
      expect(decodeEquipment('barbell')).toEqual({ ok: true, value: 'barbell' });
      expect(decodeEquipment('Barbell')).toEqual(failed);
    });
  });

  describe('level, force and mechanic', () => {
    it.each(['beginner', 'intermediate', 'expert'])('decodes level %s', (level) => {
      expect(decodeLevel(level)).toEqual({ ok: true, value: level });
    });

    it.each(['pull', 'push', 'static'])('decodes force %s', (force) => {
      expect(decodeForce(force)).toEqual({ ok: true, value: force });
    });

    it.each(['compound', 'isolation'])('decodes mechanic %s', (mechanic) => {
      expect(decodeMechanic(mechanic)).toEqual({ ok: true, value: mechanic });
    });

    it('rejects values outside each list', () => {
      expect(decodeLevel('master')).toEqual(failed);
      expect(decodeForce('toString')).toEqual(failed);
      expect(decodeMechanic(2)).toEqual(failed);
    });
  });

  describe('vocabulary kind and origin', () => {
    it.each(['category', 'muscle', 'equipment'])('decodes kind %s', (kind) => {
      expect(decodeVocabularyKind(kind)).toEqual({ ok: true, value: kind });
    });

    it.each(['builtIn', 'custom'])('decodes origin %s', (origin) => {
      expect(decodeVocabularyOrigin(origin)).toEqual({ ok: true, value: origin });
    });

    it('rejects other kinds and origins', () => {
      expect(decodeVocabularyKind('level')).toEqual(failed);
      expect(decodeVocabularyOrigin('imported')).toEqual(failed);
    });
  });

  describe('decodeTrackedMetrics', () => {
    it('keeps the stored order', () => {
      expect(decodeTrackedMetrics(['reps', 'time', 'rpe'])).toEqual({
        ok: true,
        value: ['reps', 'time', 'rpe'],
      });
    });

    it('rejects an unknown metric and an empty list', () => {
      expect(decodeTrackedMetrics(['reps', 'speed'])).toEqual(failed);
      expect(decodeTrackedMetrics([])).toEqual({
        ok: false,
        error: expect.stringMatching(/at least one/) as unknown,
      });
    });
  });

  describe('decodeBuiltInImages', () => {
    it('decodes paths and sizes into built-in images', () => {
      expect(decodeBuiltInImages([{ path: 'Squat/0.jpg', sizeBytes: 12 }])).toEqual({
        ok: true,
        value: [aBuiltInImage('Squat/0.jpg', 12)],
      });
    });

    it.each([
      ['a non-object', ['Squat/0.jpg']],
      ['an invalid path', [{ path: '../x.jpg', sizeBytes: 1 }]],
      ['a negative size', [{ path: 'Squat/0.jpg', sizeBytes: -1 }]],
      ['a fractional size', [{ path: 'Squat/0.jpg', sizeBytes: 1.5 }]],
      ['a missing size', [{ path: 'Squat/0.jpg' }]],
    ])('rejects %s', (_case, raw) => {
      expect(decodeBuiltInImages(raw)).toEqual(failed);
    });
  });

  describe('decodePhotos', () => {
    it('decodes photo file names in order', () => {
      expect(decodePhotos(['z.jpg', 'a.jpg'])).toEqual({
        ok: true,
        value: [aCustomPhoto('z.jpg'), aCustomPhoto('a.jpg')],
      });
    });

    it('rejects a file name that is not an app-owned photo', () => {
      expect(decodePhotos(['../etc/passwd'])).toEqual(failed);
      expect(decodePhotos([7])).toEqual(failed);
    });
  });

  describe('ids and source keys', () => {
    it('decodes an exercise id and rejects a blank one', () => {
      expect(decodeExerciseId('b-1')).toEqual({ ok: true, value: 'b-1' });
      expect(decodeExerciseId(' ')).toEqual(failed);
      expect(decodeExerciseId(null)).toEqual(failed);
    });

    it('decodes a dataset source key and rejects an invalid one', () => {
      expect(decodeSeedSourceKey('Barbell_Squat')).toEqual({ ok: true, value: 'Barbell_Squat' });
      expect(decodeSeedSourceKey('Barbell Squat')).toEqual(failed);
      expect(decodeSeedSourceKey(undefined)).toEqual(failed);
    });
  });

  describe('integers', () => {
    it('decodes non-negative and positive integers', () => {
      expect(decodeNonNegativeInteger(0)).toEqual({ ok: true, value: 0 });
      expect(decodePositiveInteger(3)).toEqual({ ok: true, value: 3 });
    });

    it.each([[-1], [1.5], ['2'], [Number.NaN]])('rejects %p as a non-negative integer', (raw) => {
      expect(decodeNonNegativeInteger(raw)).toEqual(failed);
    });

    it('rejects zero as a positive integer', () => {
      expect(decodePositiveInteger(0)).toEqual(failed);
    });
  });
});
