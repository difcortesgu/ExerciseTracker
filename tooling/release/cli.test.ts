import { run, type CliIo } from './cli';

const FINGERPRINT = 'ab'.repeat(32);
const SIGNING_ENV = {
  ANDROID_KEYSTORE_BASE64: 'MIIK',
  ANDROID_KEYSTORE_PASSWORD: 'p1',
  ANDROID_KEY_ALIAS: 'release',
  ANDROID_KEY_PASSWORD: 'p2',
  ANDROID_CERT_SHA256: FINGERPRINT,
};
const GITHUB_FILES = { GITHUB_ENV: '/gh/env', GITHUB_OUTPUT: '/gh/output' };

interface FakeIo extends CliIo {
  readonly files: Map<string, string>;
  readonly out: string[];
  readonly errors: string[];
}

function fakeIo(
  env: Record<string, string | undefined>,
  files: Record<string, string> = {},
): FakeIo {
  const store = new Map(Object.entries(files));
  const out: string[] = [];
  const errors: string[] = [];
  return {
    env,
    files: store,
    out,
    errors,
    appConfig: { version: '0.1.0', android: { package: 'com.farid.exercisetracker' } },
    readFile: (path) => {
      const content = store.get(path);
      if (content === undefined) {
        throw new Error(`ENOENT: ${path}`);
      }
      return content;
    },
    writeFile: (path, content) => {
      store.set(path, content);
    },
    appendFile: (path, content) => {
      store.set(path, (store.get(path) ?? '') + content);
    },
    stdout: (line) => {
      out.push(line);
    },
    stderr: (line) => {
      errors.push(line);
    },
  };
}

describe('release CLI', () => {
  it('rejects an unknown command and lists the known ones', () => {
    const io = fakeIo({});

    expect(run(['deploy'], io)).toBe(1);
    expect(io.errors.join('\n')).toMatch(/Unknown command "deploy"[\s\S]*build-number/);
  });

  it('rejects a missing command', () => {
    const io = fakeIo({});

    expect(run([], io)).toBe(1);
    expect(io.errors.join('\n')).toContain('Unknown command ""');
  });

  describe('check-release-settings (S05-02)', () => {
    it('succeeds when the four secrets and the fingerprint variable are set', () => {
      const io = fakeIo(SIGNING_ENV);

      expect(run(['check-release-settings'], io)).toBe(0);
    });

    it('fails with a GitHub error annotation naming each missing setting', () => {
      const io = fakeIo({ ...SIGNING_ENV, ANDROID_KEY_ALIAS: '', ANDROID_CERT_SHA256: undefined });

      expect(run(['check-release-settings'], io)).toBe(1);
      expect(io.errors.join('\n')).toMatch(/^::error::.*ANDROID_KEY_ALIAS.*ANDROID_CERT_SHA256/m);
    });

    it('never prints secret values', () => {
      const io = fakeIo({ ...SIGNING_ENV, ANDROID_CERT_SHA256: '' });

      run(['check-release-settings'], io);

      expect([...io.out, ...io.errors].join('\n')).not.toMatch(/MIIK|p1|p2/);
    });
  });

  describe('build-number (S05-01)', () => {
    it('exports APP_BUILD_NUMBER for the following steps', () => {
      const io = fakeIo({ GITHUB_RUN_NUMBER: '57', BUILD_NUMBER_OFFSET: '', ...GITHUB_FILES });

      expect(run(['build-number'], io)).toBe(0);
      expect(io.files.get('/gh/env')).toBe('APP_BUILD_NUMBER=57\n');
    });

    it('outputs build_number for the jobs that depend on this one', () => {
      const io = fakeIo({ GITHUB_RUN_NUMBER: '57', ...GITHUB_FILES });

      run(['build-number'], io);

      expect(io.files.get('/gh/output')).toBe('build_number=57\n');
    });

    it('fails when the run number is unusable', () => {
      const io = fakeIo({ GITHUB_RUN_NUMBER: 'x', ...GITHUB_FILES });

      expect(run(['build-number'], io)).toBe(1);
      expect(io.errors.join('\n')).toContain('GITHUB_RUN_NUMBER');
    });

    it('fails outside GitHub Actions (no GITHUB_ENV or GITHUB_OUTPUT file)', () => {
      const io = fakeIo({ GITHUB_RUN_NUMBER: '57' });

      expect(run(['build-number'], io)).toBe(1);
      expect(io.errors.join('\n')).toContain('GITHUB_ENV, GITHUB_OUTPUT');
    });
  });

  describe('plan-release (S05-01, S05-03)', () => {
    const env = { APP_BUILD_NUMBER: '12', ...GITHUB_FILES };

    it('outputs the tag, title and asset name of a build to publish', () => {
      const io = fakeIo(env, { '/tmp/tags': 'abc\trefs/tags/build-11\n' });

      expect(run(['plan-release', '/tmp/tags'], io)).toBe(0);
      expect(io.files.get('/gh/output')).toBe(
        'publish=true\ntag=build-12\ntitle=Build 12\nasset_name=exercise-tracker-build-12.apk\n',
      );
    });

    it('skips publishing an already published build with a notice', () => {
      const io = fakeIo(env, { '/tmp/tags': 'abc\trefs/tags/build-12\n' });

      expect(run(['plan-release', '/tmp/tags'], io)).toBe(0);
      expect(io.files.get('/gh/output')).toBe('publish=false\n');
      expect(io.out.join('\n')).toMatch(/^::notice::.*build-12/m);
    });

    it('skips publishing a build superseded by a newer release with a warning', () => {
      const io = fakeIo(env, { '/tmp/tags': 'abc\trefs/tags/build-14\n' });

      expect(run(['plan-release', '/tmp/tags'], io)).toBe(0);
      expect(io.files.get('/gh/output')).toBe('publish=false\n');
      expect(io.out.join('\n')).toMatch(/^::warning::.*14/m);
    });

    it('fails without the tags file argument', () => {
      const io = fakeIo(env);

      expect(run(['plan-release'], io)).toBe(1);
      expect(io.errors.join('\n')).toContain('Usage: plan-release <remote-tags-file>');
    });

    it('fails without a valid APP_BUILD_NUMBER', () => {
      const io = fakeIo({ ...GITHUB_FILES }, { '/tmp/tags': '' });

      expect(run(['plan-release', '/tmp/tags'], io)).toBe(1);
      expect(io.errors.join('\n')).toContain('APP_BUILD_NUMBER');
    });

    it('fails when the tags file cannot be read', () => {
      const io = fakeIo(env);

      expect(run(['plan-release', '/tmp/missing-tags'], io)).toBe(1);
      expect(io.files.get('/gh/output')).toBeUndefined();
    });

    it('fails outside GitHub Actions (no GITHUB_OUTPUT file)', () => {
      const io = fakeIo({ APP_BUILD_NUMBER: '12' }, { '/tmp/tags': '' });

      expect(run(['plan-release', '/tmp/tags'], io)).toBe(1);
      expect(io.errors.join('\n')).toContain('GITHUB_OUTPUT');
    });
  });

  describe('release-notes (S05-03)', () => {
    const env = {
      APP_BUILD_NUMBER: '12',
      GITHUB_SHA: 'f'.repeat(40),
      COMMIT_SUBJECT: 'Fix the timer',
      GITHUB_SERVER_URL: 'https://github.com',
      GITHUB_REPOSITORY: 'difcortesgu/ExerciseTracker',
      GITHUB_RUN_ID: '99',
    };

    it('writes the notes with commit, subject and run link to the given file', () => {
      const io = fakeIo(env);

      expect(run(['release-notes', '/tmp/notes.md'], io)).toBe(0);
      const notes = io.files.get('/tmp/notes.md') ?? '';
      expect(notes).toContain('f'.repeat(40));
      expect(notes).toContain('Fix the timer');
      expect(notes).toContain('https://github.com/difcortesgu/ExerciseTracker/actions/runs/99');
    });

    it('fails when a GitHub variable is missing', () => {
      const io = fakeIo({ ...env, GITHUB_SHA: undefined });

      expect(run(['release-notes', '/tmp/notes.md'], io)).toBe(1);
      expect(io.errors.join('\n')).toContain('GITHUB_SHA');
    });

    it('fails without a valid APP_BUILD_NUMBER', () => {
      const io = fakeIo({ ...env, APP_BUILD_NUMBER: '0' });

      expect(run(['release-notes', '/tmp/notes.md'], io)).toBe(1);
      expect(io.files.has('/tmp/notes.md')).toBe(false);
    });

    it('accepts an empty commit subject', () => {
      const io = fakeIo({ ...env, COMMIT_SUBJECT: undefined });

      expect(run(['release-notes', '/tmp/notes.md'], io)).toBe(0);
      expect(io.files.get('/tmp/notes.md')).toContain('(no commit subject)');
    });

    it('fails without the output file argument', () => {
      const io = fakeIo(env);

      expect(run(['release-notes'], io)).toBe(1);
      expect(io.errors.join('\n')).toContain('Usage: release-notes <output-file>');
    });
  });

  describe('verify-certificate (S05-02)', () => {
    const output = `Signer #1 certificate SHA-256 digest: ${FINGERPRINT}\n`;

    it('succeeds when the APK is signed with the expected certificate', () => {
      const io = fakeIo(SIGNING_ENV, { '/tmp/certs': output });

      expect(run(['verify-certificate', '/tmp/certs'], io)).toBe(0);
      expect(io.out.join('\n')).toContain(FINGERPRINT);
    });

    it('fails with an error annotation on a mismatch', () => {
      const io = fakeIo(
        { ...SIGNING_ENV, ANDROID_CERT_SHA256: 'cd'.repeat(32) },
        {
          '/tmp/certs': output,
        },
      );

      expect(run(['verify-certificate', '/tmp/certs'], io)).toBe(1);
      expect(io.errors.join('\n')).toMatch(/^::error::/m);
    });

    it('fails clearly when the expected fingerprint is not configured', () => {
      const io = fakeIo({}, { '/tmp/certs': output });

      expect(run(['verify-certificate', '/tmp/certs'], io)).toBe(1);
      expect(io.errors.join('\n')).toContain('ANDROID_CERT_SHA256');
    });

    it('fails without the apksigner output argument', () => {
      expect(run(['verify-certificate'], fakeIo(SIGNING_ENV))).toBe(1);
    });
  });

  describe('verify-apk (S05-01, S05-02, S05-10)', () => {
    const badging = (versionCode: string): string =>
      `package: name='com.farid.exercisetracker' versionCode='${versionCode}' versionName='0.1.0'\nuses-permission: name='android.permission.REQUEST_INSTALL_PACKAGES'\n`;

    it('succeeds when package, versionCode, versionName and permission match', () => {
      const io = fakeIo({ APP_BUILD_NUMBER: '12' }, { '/tmp/badging': badging('12') });

      expect(run(['verify-apk', '/tmp/badging'], io)).toBe(0);
    });

    it('fails when the versionCode is not the build number', () => {
      const io = fakeIo({ APP_BUILD_NUMBER: '12' }, { '/tmp/badging': badging('1') });

      expect(run(['verify-apk', '/tmp/badging'], io)).toBe(1);
      expect(io.errors.join('\n')).toMatch(/^::error::.*versionCode/m);
    });

    it('fails without a valid APP_BUILD_NUMBER', () => {
      const io = fakeIo({}, { '/tmp/badging': badging('12') });

      expect(run(['verify-apk', '/tmp/badging'], io)).toBe(1);
    });

    it('fails when the badging file cannot be read', () => {
      const io = fakeIo({ APP_BUILD_NUMBER: '12' });

      expect(run(['verify-apk', '/tmp/missing-badging'], io)).toBe(1);
      expect(io.errors.join('\n')).toContain('/tmp/missing-badging');
    });

    it('fails without the badging argument', () => {
      expect(run(['verify-apk'], fakeIo({ APP_BUILD_NUMBER: '12' }))).toBe(1);
    });
  });

  it('reports an unreadable input file as a failure instead of crashing', () => {
    const io = fakeIo(SIGNING_ENV);

    expect(run(['verify-certificate', '/missing'], io)).toBe(1);
    expect(io.errors.join('\n')).toMatch(/^::error::.*ENOENT: \/missing/m);
  });
});
