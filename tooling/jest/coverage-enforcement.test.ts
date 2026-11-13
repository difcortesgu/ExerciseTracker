/**
 * S0-05: the per-layer thresholds really fail the build. Runs Jest with the real coverage
 * configuration on a fixture project whose domain file has uncovered branches.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const FIXTURE = path.join(__dirname, '__fixtures__', 'coverage-project');
const JEST_BIN = require.resolve('jest/bin/jest');

describe('coverage threshold enforcement', () => {
  it('exits non-zero and names the domain file and threshold when a domain branch is uncovered', () => {
    const result = spawnSync(
      process.execPath,
      [JEST_BIN, '--config', path.join(FIXTURE, 'jest.config.js'), '--coverage', '--ci'],
      { cwd: FIXTURE, encoding: 'utf8' },
    );
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain('Tests:       1 passed');
    expect(output).toMatch(
      /Coverage for branches \(50%\) does not meet ".*\/src\/shared\/domain\/clamp\.ts" threshold \(100%\)/,
    );
  });
});
