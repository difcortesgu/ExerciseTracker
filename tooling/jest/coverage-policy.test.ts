import { COVERAGE_POLICY, LAYER_GLOBS, RELEASE_TOOLING_GLOB } from './coverage-policy';

/**
 * Guard rail for docs/ENGINEERING_STANDARDS.md §4.3: thresholds may only go up.
 * Lowering a value below the agreed floor makes this test fail.
 */
describe('coverage policy', () => {
  const floors = {
    [LAYER_GLOBS.domain]: { lines: 100, branches: 100, functions: 100, statements: 100 },
    [LAYER_GLOBS.application]: { lines: 100, branches: 95, functions: 100, statements: 100 },
    [LAYER_GLOBS.infrastructure]: { lines: 90, branches: 90, functions: 90, statements: 90 },
    [LAYER_GLOBS.presentation]: { lines: 85, branches: 85, functions: 85, statements: 85 },
    [LAYER_GLOBS.core]: { lines: 90, branches: 90, functions: 90, statements: 90 },
    global: { lines: 90, branches: 85, functions: 90, statements: 90 },
    // CI release scripts (Sprint 0.5, ADR-003): pure decision logic, held to the domain standard.
    [RELEASE_TOOLING_GLOB]: { lines: 100, branches: 100, functions: 100, statements: 100 },
  };

  it.each(Object.entries(floors))('does not go below the agreed floor for %s', (key, floor) => {
    const actual = COVERAGE_POLICY[key];

    expect(actual).toBeDefined();
    for (const [metric, minimum] of Object.entries(floor)) {
      expect(actual?.[metric as keyof typeof floor]).toBeGreaterThanOrEqual(minimum);
    }
  });

  it('covers presentation folders of modules and the shared design system with one glob', () => {
    expect(LAYER_GLOBS.presentation).toBe('src/{modules/*/presentation,shared/ui}/**/*.{ts,tsx}');
  });

  it('applies the domain threshold to the shared kernel and every module domain', () => {
    expect(LAYER_GLOBS.domain).toBe('src/{shared,modules/*}/domain/**/*.{ts,tsx}');
  });

  it('measures the CI release scripts under tooling/release', () => {
    expect(RELEASE_TOOLING_GLOB).toBe('tooling/release/**/*.js');
  });
});
