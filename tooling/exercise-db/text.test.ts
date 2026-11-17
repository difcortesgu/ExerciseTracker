import { comparisonKey, normaliseDisplayText, sentenceCase } from './text';

/**
 * The same examples pin the app's domain comparison function (S1-08, `exercises/domain`), so the
 * converter and the app agree on what "the same name" means (ADR-004 "Name comparison").
 */
describe('normaliseDisplayText', () => {
  it('trims and collapses inner runs of whitespace to one space', () => {
    expect(normaliseDisplayText('  Barbell \t  squat\n')).toBe('Barbell squat');
  });

  it('keeps case and accents (it is the text shown to the user)', () => {
    expect(normaliseDisplayText('Préss Fráncés')).toBe('Préss Fráncés');
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
});

describe('sentenceCase', () => {
  it('capitalises the first letter of a dataset value for display', () => {
    expect(sentenceCase('body only')).toBe('Body only');
    expect(sentenceCase('e-z curl bar')).toBe('E-z curl bar');
  });

  it('leaves an empty value empty', () => {
    expect(sentenceCase('')).toBe('');
  });
});
