import { clamp } from './clamp';

// Deliberately leaves branches uncovered: the enforcement test expects the domain threshold to fail.
it('returns the value when it is inside the range', () => {
  expect(clamp(5, 0, 10)).toBe(5);
});
