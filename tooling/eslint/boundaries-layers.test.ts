/**
 * S0-07: the inward-only layer rule (domain ← application ← infrastructure/presentation) is
 * enforced by lint. Each case lints a virtual file placed in the fixture project and asserts the
 * boundary error (or its absence). Split from boundaries.test.ts by concern (S1-03).
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  createFixtureLinter,
  FIXTURE_ROOT,
  BOUNDARIES,
  importing,
  ruleIdsOf,
  type FixtureLinter,
} from './lint-fixture';

let linter: FixtureLinter;

beforeAll(() => {
  linter = createFixtureLinter();
});

describe('fixture project', () => {
  it('uses the same path aliases as the real project', () => {
    const readPaths = (file: string): unknown =>
      JSON.parse(fs.readFileSync(file, 'utf8')).compilerOptions.paths;

    expect(readPaths(path.join(FIXTURE_ROOT, 'tsconfig.json'))).toEqual(
      readPaths(path.join(__dirname, '..', '..', 'tsconfig.json')),
    );
  });
});

describe('layer dependency rule', () => {
  it.each([
    ['shared domain', 'src/shared/domain/x.ts', '@shared/application/shared-application'],
    ['module domain', 'src/modules/alpha/domain/x.ts', '../application/alpha-application'],
    ['module domain', 'src/modules/alpha/domain/x.ts', '../infrastructure/alpha-infrastructure'],
    ['module domain', 'src/modules/alpha/domain/x.ts', '../presentation/alpha-presentation'],
    [
      'module domain',
      'src/modules/alpha/domain/x.ts',
      '@shared/infrastructure/shared-infrastructure',
    ],
    [
      'module application',
      'src/modules/alpha/application/x.ts',
      '../infrastructure/alpha-infrastructure',
    ],
    [
      'module application',
      'src/modules/alpha/application/x.ts',
      '../presentation/alpha-presentation',
    ],
    [
      'shared application',
      'src/shared/application/x.ts',
      '@shared/infrastructure/shared-infrastructure',
    ],
    [
      'module infrastructure',
      'src/modules/alpha/infrastructure/x.ts',
      '../presentation/alpha-presentation',
    ],
    [
      'module presentation',
      'src/modules/alpha/presentation/x.ts',
      '../infrastructure/alpha-infrastructure',
    ],
    [
      'module presentation',
      'src/modules/alpha/presentation/x.ts',
      '@shared/infrastructure/shared-infrastructure',
    ],
    ['shared ui', 'src/shared/ui/x.ts', '@shared/infrastructure/shared-infrastructure'],
  ])('rejects %s (%s) importing %s', async (_layer, file, specifier) => {
    const errors = await linter.lintAs(file, importing(specifier));

    expect(ruleIdsOf(errors)).toContain(BOUNDARIES);
  });

  it.each([
    ['module domain', 'src/modules/alpha/domain/x.ts', '@shared/domain/shared-domain'],
    ['module domain', 'src/modules/alpha/domain/x.ts', './alpha-domain'],
    ['module application', 'src/modules/alpha/application/x.ts', '../domain/alpha-domain'],
    [
      'module application',
      'src/modules/alpha/application/x.ts',
      '@shared/application/shared-application',
    ],
    [
      'module infrastructure',
      'src/modules/alpha/infrastructure/x.ts',
      '../application/alpha-application',
    ],
    ['module infrastructure', 'src/modules/alpha/infrastructure/x.ts', '../domain/alpha-domain'],
    [
      'module infrastructure',
      'src/modules/alpha/infrastructure/x.ts',
      '@shared/infrastructure/shared-infrastructure',
    ],
    [
      'module presentation',
      'src/modules/alpha/presentation/x.ts',
      '../application/alpha-application',
    ],
    ['module presentation', 'src/modules/alpha/presentation/x.ts', '@shared/ui/shared-ui'],
    [
      'module presentation',
      'src/modules/alpha/presentation/x.ts',
      '@core/presentation/use-dependency',
    ],
    [
      'shared infrastructure',
      'src/shared/infrastructure/x.ts',
      '@shared/application/shared-application',
    ],
  ])('allows %s (%s) importing %s', async (_layer, file, specifier) => {
    const errors = await linter.lintAs(file, importing(specifier));

    expect(errors).toEqual([]);
  });
});
