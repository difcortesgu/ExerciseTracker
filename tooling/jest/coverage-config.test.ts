import path from 'node:path';

import { createCoverageConfig } from './coverage-config';
import { LAYER_GLOBS, RELEASE_TOOLING_GLOB } from './coverage-policy';

const FIXTURE_ROOT = path.join(__dirname, '__fixtures__', 'coverage-scope');
const EMPTY_ROOT = path.join(__dirname, '__fixtures__', 'coverage-project', 'src');

describe('coverage configuration scope', () => {
  it('collects coverage from the CI release scripts as well as from src/', () => {
    const { collectCoverageFrom } = createCoverageConfig(FIXTURE_ROOT);

    expect(collectCoverageFrom).toEqual(
      expect.arrayContaining(['src/**/*.{ts,tsx}', RELEASE_TOOLING_GLOB]),
    );
  });

  it('excludes only the release CLI process entry point (wiring, spawned by its own test)', () => {
    const { collectCoverageFrom } = createCoverageConfig(FIXTURE_ROOT);

    expect(collectCoverageFrom.filter((glob) => glob.startsWith('!tooling/'))).toEqual([
      '!tooling/release/release-cli.js',
    ]);
  });

  it('activates the release tooling threshold when a release script exists', () => {
    const { coverageThreshold } = createCoverageConfig(FIXTURE_ROOT);

    expect(coverageThreshold).toHaveProperty([RELEASE_TOOLING_GLOB]);
    expect(coverageThreshold).toHaveProperty([LAYER_GLOBS.domain]);
  });

  it('leaves the release tooling threshold off in a project without release scripts', () => {
    const { coverageThreshold } = createCoverageConfig(EMPTY_ROOT);

    expect(coverageThreshold).not.toHaveProperty([RELEASE_TOOLING_GLOB]);
  });
});
