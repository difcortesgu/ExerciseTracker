import * as fc from 'fast-check';

import { characterCount, comparisonKey, type ComparisonKey } from './comparison-key';
import { suggestDuplicateName } from './duplicate-name';
import { EXERCISE_LIMITS } from './exercise-draft';

const taken = (...names: readonly string[]): ReadonlySet<ComparisonKey> =>
  new Set(names.map(comparisonKey));

describe('suggestDuplicateName (S1-23)', () => {
  it('appends "(custom)" when that name is free', () => {
    expect(suggestDuplicateName('Barbell Squat', taken('Barbell Squat'))).toBe(
      'Barbell Squat (custom)',
    );
  });

  it('uses the first free number from 2 upwards', () => {
    expect(
      suggestDuplicateName('Barbell Squat', taken('Barbell Squat', 'Barbell Squat (custom)')),
    ).toBe('Barbell Squat (custom 2)');
    expect(
      suggestDuplicateName(
        'Barbell Squat',
        taken('barbell squat (CUSTOM)', 'Bárbell Squat (custom 2)', 'Barbell Squat (custom 4)'),
      ),
    ).toBe('Barbell Squat (custom 3)');
  });

  it('normalises the base name first', () => {
    expect(suggestDuplicateName('  Barbell   Squat ', taken())).toBe('Barbell Squat (custom)');
  });

  it('shortens a long base name so the result stays within 80 characters', () => {
    const suggestion = suggestDuplicateName('a'.repeat(80), taken());

    expect(characterCount(suggestion)).toBe(EXERCISE_LIMITS.nameMaxLength);
    expect(suggestion).toBe(`${'a'.repeat(71)} (custom)`);
  });

  it('never ends the shortened base with a space before the suffix', () => {
    const long = `${'a'.repeat(70)} ${'b'.repeat(20)}`;

    expect(suggestDuplicateName(long, taken())).toBe(`${'a'.repeat(70)} (custom)`);
  });

  it('never collides with a taken name and stays within the maximum', () => {
    const anyBase = fc
      .string({ minLength: 1, maxLength: 90, unit: 'grapheme' })
      .filter((name) => name.trim().length > 0);
    fc.assert(
      fc.property(anyBase, fc.array(fc.nat({ max: 6 }), { maxLength: 6 }), (base, numbers) => {
        const occupied = taken(
          base,
          suggestDuplicateName(base, taken()),
          ...numbers.map((number) => `${base} (custom ${number})`),
        );

        const suggestion = suggestDuplicateName(base, occupied);

        expect(occupied.has(comparisonKey(suggestion))).toBe(false);
        expect(characterCount(suggestion)).toBeLessThanOrEqual(EXERCISE_LIMITS.nameMaxLength);
      }),
    );
  });
});
