import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ENTRY = path.join(__dirname, 'release-cli.js');

/** The workflow runs exactly this: `node tooling/release/release-cli.js <command> …`. */
const runEntry = (args: readonly string[], env: Record<string, string>) =>
  spawnSync(process.execPath, [ENTRY, ...args], {
    encoding: 'utf8',
    // A minimal environment, so variables of the machine running the tests cannot leak in.
    env: { PATH: process.env.PATH ?? '', NODE_ENV: 'test', ...env },
  });

describe('release CLI process entry point (wiring of run() to the real process)', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-cli-'));
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('appends to the real GITHUB_ENV file and exits with 0', () => {
    const githubEnv = path.join(workDir, 'github-env');
    fs.writeFileSync(githubEnv, 'EXISTING=1\n');

    const result = runEntry(['build-number'], {
      GITHUB_RUN_NUMBER: '7',
      GITHUB_ENV: githubEnv,
      GITHUB_OUTPUT: path.join(workDir, 'github-output'),
    });

    expect(result.status).toBe(0);
    expect(fs.readFileSync(githubEnv, 'utf8')).toBe('EXISTING=1\nAPP_BUILD_NUMBER=7\n');
  });

  it('reads the real app.json for the expected package and version', () => {
    const badging = path.join(workDir, 'badging.txt');
    fs.writeFileSync(
      badging,
      "package: name='com.farid.exercisetracker' versionCode='7' versionName='0.1.0'\nuses-permission: name='android.permission.REQUEST_INSTALL_PACKAGES'\n",
    );

    const result = runEntry(['verify-apk', badging], { APP_BUILD_NUMBER: '7' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('APK identity verified');
  });

  it('writes failures to stderr and exits with 1', () => {
    const result = runEntry(['no-such-command'], {});

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('::error::Unknown command "no-such-command"');
  });
});
