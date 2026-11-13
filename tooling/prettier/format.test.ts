/**
 * S0-03: `prettier --check` with the project configuration reports badly formatted files.
 * Runs the real CLI (as `npm run format:check` does) on temporary files.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.join(__dirname, '..', '..');
const PRETTIER_BIN = require.resolve('prettier/bin/prettier.cjs');

function checkFormatting(source: string): {
  readonly exitCode: number | null;
  readonly output: string;
} {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'prettier-check-'));
  const file = path.join(directory, 'sample.ts');
  fs.writeFileSync(file, source);
  try {
    const result = spawnSync(
      process.execPath,
      [PRETTIER_BIN, '--check', '--config', path.join(ROOT, '.prettierrc.json'), file],
      { encoding: 'utf8' },
    );
    return { exitCode: result.status, output: `${result.stdout}${result.stderr}` };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

describe('prettier --check with the project configuration', () => {
  it('reports a badly formatted file', () => {
    const { exitCode, output } = checkFormatting('export const  reps={value:12}');

    expect(exitCode).toBe(1);
    expect(output).toContain('sample.ts');
  });

  it('accepts code in the project style (single quotes, trailing commas, semicolons)', () => {
    const { exitCode } = checkFormatting(
      "export const exercise = {\n  name: 'Squat',\n  sets: [1, 2, 3],\n};\n",
    );

    expect(exitCode).toBe(0);
  });
});
