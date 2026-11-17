import * as fc from 'fast-check';

import { characterCount, comparisonKey, normaliseDisplayText } from './comparison-key';

/**
 * The same examples pin the converter's copy of the rule (`tooling/exercise-db/text.test.ts`), so
 * the app and the converter agree on what "the same name" means (ADR-004 "Name comparison").
 */
describe('normaliseDisplayText', () => {
  it('trims and collapses inner runs of whitespace to one space', () => {
    expect(normaliseDisplayText('  Barbell \t  squat\n')).toBe('Barbell squat');
  });

  it('keeps case and accents (it is the text shown to the user)', () => {
    expect(normaliseDisplayText('Préss Fráncés')).toBe('Préss Fráncés');
  });

  it('turns whitespace-only text into the empty string', () => {
    expect(normaliseDisplayText(' \t\n ')).toBe('');
  });
});

describe('comparisonKey', () => {
  it('treats names that differ only in spacing and case as equal', () => {
    expect(comparisonKey('  Barbell   squat ')).toBe(comparisonKey('barbell SQUAT'));
  });

  it('ignores accents (Unicode NFD with combining marks removed)', () => {
    expect(comparisonKey('Préss')).toBe(comparisonKey('press'));
    expect(comparisonKey('Préss')).toBe('press');
  });

  it('keeps different words different', () => {
    expect(comparisonKey('Squat')).not.toBe(comparisonKey('Squats'));
  });

  it('removes marks of every listed combining block', () => {
    // U+0301, U+1AB0, U+1DC0, U+20D0, U+FE20 (one per block of the explicit class)
    expect(comparisonKey('áb᪰c᷀d⃐e︠')).toBe('abcde');
  });

  it('collapses the whitespace left behind by a removed mark', () => {
    expect(comparisonKey('Bench ́ press')).toBe('bench press');
  });

  it('folds a dotted capital I to a plain i', () => {
    expect(comparisonKey('İnc')).toBe('inc');
  });

  it('is idempotent for any text', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (text) => {
        expect(comparisonKey(comparisonKey(text))).toBe(comparisonKey(text));
      }),
    );
  });

  it('gives texts that differ only in case and surrounding spaces the same key', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme-ascii' }), (text) => {
        expect(comparisonKey(`  ${text.toUpperCase()} `)).toBe(comparisonKey(text));
      }),
    );
  });
});

describe('characterCount', () => {
  it('counts characters (code points), not UTF-16 units', () => {
    expect(characterCount('Squat')).toBe(5);
    expect(characterCount('💪💪')).toBe(2);
    expect(characterCount('')).toBe(0);
  });
});
