/**
 * S0-07: test support (fakes, builders, contracts) is isolated from production code, test files
 * keep their layer's rules, and every file belongs to a known element. Split from
 * boundaries.test.ts by concern (S1-03).
 */
import {
  createFixtureLinter,
  BOUNDARIES,
  importing,
  ruleIdsOf,
  type FixtureLinter,
} from './lint-fixture';

let linter: FixtureLinter;

beforeAll(() => {
  linter = createFixtureLinter();
});

describe('test support isolation', () => {
  it.each([
    ['src/modules/alpha/domain/x.ts', '@test/builders/routine.builder'],
    ['src/core/di/composition-root.ts', '@test/fakes/fake-clock'],
    ['app/index.tsx', '@test/fakes/fake-clock'],
  ])('rejects production file %s importing %s', async (file, specifier) => {
    const errors = await linter.lintAs(file, importing(specifier));

    expect(ruleIdsOf(errors)).toContain(BOUNDARIES);
  });

  it.each([
    ['src/modules/alpha/domain/x.test.ts', '@test/builders/routine.builder'],
    ['src/modules/alpha/presentation/x.test.tsx', '@test/fakes/fake-clock'],
    ['src/modules/alpha/presentation/x.test.tsx', '@core/di/container'],
  ])('allows test file %s to import %s', async (file, specifier) => {
    const errors = await linter.lintAs(file, importing(specifier));

    expect(errors).toEqual([]);
  });

  it('still applies the layer rule to test files', async () => {
    const errors = await linter.lintAs(
      'src/modules/alpha/domain/x.test.ts',
      importing('../infrastructure/alpha-infrastructure'),
    );

    expect(ruleIdsOf(errors)).toContain(BOUNDARIES);
  });
});

describe('unclassified files', () => {
  it('rejects a source file outside the agreed folder structure', async () => {
    const errors = await linter.lintAs('src/helpers/format.ts', 'export const format = 1;\n');

    expect(ruleIdsOf(errors)).toContain('boundaries/no-unknown-files');
  });

  it('rejects a source file directly in src/core outside di, bootstrap and presentation', async () => {
    const errors = await linter.lintAs('src/core/logger.ts', 'export const logger = 1;\n');

    expect(ruleIdsOf(errors)).toContain('boundaries/no-unknown-files');
  });
});
