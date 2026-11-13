import { assertNever } from './assert-never';

type Shape = { readonly kind: 'circle' } | { readonly kind: 'square' };

const sides = (shape: Shape): number => {
  switch (shape.kind) {
    case 'circle':
      return 0;
    case 'square':
      return 4;
    default:
      return assertNever(shape);
  }
};

describe('assertNever', () => {
  it('lets an exhaustive switch compile and run', () => {
    expect(sides({ kind: 'square' })).toBe(4);
    expect(sides({ kind: 'circle' })).toBe(0);
  });

  it('throws a programmer error naming the unexpected value', () => {
    const unexpected: unknown = { kind: 'triangle' };

    // @ts-expect-error -- only `never` is accepted, which proves exhaustiveness at compile time
    expect(() => assertNever(unexpected)).toThrow(/triangle/);
  });
});
