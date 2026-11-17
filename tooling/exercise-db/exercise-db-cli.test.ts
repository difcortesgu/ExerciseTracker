import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { anUpstreamExercise, aTreeFor } from './upstream-fixtures';

const ENTRY = path.join(__dirname, 'exercise-db-cli.js');

const runEntry = (args: readonly string[]) =>
  spawnSync(process.execPath, [ENTRY, ...args], { encoding: 'utf8' });

describe('exercise-db CLI process entry point (wiring of run() to the real process)', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exercise-db-cli-'));
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('converts real files and exits with 0', () => {
    const exercises = [anUpstreamExercise()];
    const upstream = path.join(workDir, 'exercises.json');
    const tree = path.join(workDir, 'tree.json');
    fs.writeFileSync(upstream, JSON.stringify(exercises));
    fs.writeFileSync(tree, JSON.stringify(aTreeFor(exercises)));

    const result = runEntry([upstream, tree, workDir]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Seed version 1: 1 exercises');
    expect(fs.existsSync(path.join(workDir, 'manifest.json'))).toBe(true);
  });

  it('writes failures to stderr and exits with 1', () => {
    const result = runEntry([]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Usage: node tooling/exercise-db/exercise-db-cli.js');
  });
});
