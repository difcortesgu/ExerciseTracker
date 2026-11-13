/**
 * Proves the test toolchain (S0-04): pure TS, React Native Testing Library, fast-check,
 * path aliases and inlined .sql imports (used for drizzle-kit migrations) all work in Jest.
 */
import { render, screen } from '@testing-library/react-native';
import * as fc from 'fast-check';
import { Text, View } from 'react-native';

import * as routinesModule from '@modules/routines';
import { ALIAS_TARGET } from '@test/toolchain/alias-target';

import sampleSql from './fixtures/sample.sql';

const FAST_CHECK_SEED = 42;

describe('Jest toolchain', () => {
  it('runs a pure TypeScript test', () => {
    const pair = <A, B>(first: A, second: B): readonly [A, B] => [first, second];

    expect(pair('reps', 12)).toEqual(['reps', 12]);
  });

  it('renders a React Native component and queries it by accessibility label', async () => {
    await render(
      <View accessibilityLabel="Greeting">
        <Text>Hello lifter</Text>
      </View>,
    );

    expect(screen.getByLabelText('Greeting')).toHaveTextContent('Hello lifter');
  });

  it('runs fast-check properties', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        expect(a + b).toBe(b + a);
      }),
      { seed: FAST_CHECK_SEED },
    );
  });

  it('reports a shrunk counterexample when a property fails', () => {
    const result = fc.check(
      fc.property(fc.integer({ min: 0 }), (n) => n < 10),
      { seed: FAST_CHECK_SEED },
    );

    expect(result.failed).toBe(true);
    expect(result.counterexample).toEqual([10]);
  });

  it('resolves tsconfig path aliases', () => {
    expect(ALIAS_TARGET).toBe('resolved through @test/*');
    expect(routinesModule).toBeDefined();
  });

  it('inlines .sql files as strings, as Metro does for drizzle-kit migrations', () => {
    expect(sampleSql).toContain('CREATE TABLE `sample`');
  });
});
