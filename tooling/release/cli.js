// @ts-check
/**
 * Release CLI called by the CI workflow's release job (S05-01 to S05-04; ADR-003).
 *
 * Command pattern + registry: each subcommand is one handler in `COMMANDS`; adding a check means
 * adding an entry, not editing a switch. All I/O goes through `CliIo` so every handler is tested
 * in-process; `release-cli.js` binds it to the real process. Handlers return an outcome instead of
 * throwing; `run` turns a failure into a GitHub `::error::` annotation and exit code 1.
 */
const { INSTALL_PACKAGES_PERMISSION, verifyApkBadging } = require('./apk-badging');
const { APP_BUILD_NUMBER_ENV, parseBuildNumber } = require('./release-format');
const { formatReleaseNotes } = require('./release-notes');
const { planRelease, resolveBuildNumber } = require('./release-plan');
const {
  CERTIFICATE_FINGERPRINT_VARIABLE,
  findMissingReleaseSettings,
  verifySigningCertificate,
} = require('./signing');

/**
 * @typedef {object} CliIo
 * @property {Readonly<Record<string, string | undefined>>} env
 * @property {{ version: string, android: { package: string } }} appConfig static Expo config
 * @property {(path: string) => string} readFile
 * @property {(path: string, content: string) => void} writeFile
 * @property {(path: string, content: string) => void} appendFile
 * @property {(line: string) => void} stdout
 * @property {(line: string) => void} stderr
 */

/**
 * @template T
 * @typedef {{ ok: true, value: T } | { ok: false, error: string }} Outcome
 */

/** @typedef {(args: readonly string[], io: CliIo) => Outcome<unknown>} Command */

const EXIT_OK = 0;
const EXIT_FAILURE = 1;

/** @type {Outcome<undefined>} */
const DONE = { ok: true, value: undefined };

/** @param {string} error @returns {{ ok: false, error: string }} */
const failure = (error) => ({ ok: false, error });

/**
 * @template {string} Name
 * @param {CliIo['env']} env
 * @param {readonly Name[]} names
 * @returns {Outcome<Record<Name, string>>}
 */
function requireEnv(env, names) {
  const missing = names.filter((name) => !env[name]);
  if (missing.length > 0) {
    return failure(`Not set: ${missing.join(', ')}.`);
  }
  return {
    ok: true,
    value: /** @type {Record<Name, string>} */ (
      Object.fromEntries(names.map((name) => [name, env[name]]))
    ),
  };
}

/** @param {CliIo['env']} env @returns {Outcome<number>} */
function requireBuildNumber(env) {
  const buildNumber = parseBuildNumber(env[APP_BUILD_NUMBER_ENV] ?? '');
  return buildNumber === null
    ? failure(`${APP_BUILD_NUMBER_ENV} is missing or invalid; run "build-number" first.`)
    : { ok: true, value: buildNumber };
}

/** @param {readonly string[]} args @param {string} usage @returns {Outcome<string>} */
const requireArgument = (args, usage) =>
  args[0] === undefined ? failure(`Usage: ${usage}`) : { ok: true, value: args[0] };

/** @param {CliIo} io @param {string} path @returns {Outcome<string>} */
function readInput(io, path) {
  try {
    return { ok: true, value: io.readFile(path) };
  } catch (cause) {
    return failure(`Cannot read ${path}: ${String(cause)}`);
  }
}

/** @type {Command} */
function checkReleaseSettings(_args, io) {
  const missing = findMissingReleaseSettings(io.env);
  if (missing.length > 0) {
    return failure(
      `Missing release settings: ${missing.join(', ')}. Signing values are repository secrets and ` +
        `${CERTIFICATE_FINGERPRINT_VARIABLE} is a repository variable (Settings > Secrets and variables > Actions).`,
    );
  }
  io.stdout('All release settings are present.');
  return DONE;
}

/** @type {Command} */
function buildNumber(_args, io) {
  const targets = requireEnv(io.env, ['GITHUB_ENV', 'GITHUB_OUTPUT']);
  if (!targets.ok) return targets;
  const resolved = resolveBuildNumber({
    runNumber: io.env.GITHUB_RUN_NUMBER,
    offset: io.env.BUILD_NUMBER_OFFSET,
  });
  if (!resolved.ok) return resolved;
  io.appendFile(targets.value.GITHUB_ENV, `${APP_BUILD_NUMBER_ENV}=${resolved.value}\n`);
  io.appendFile(targets.value.GITHUB_OUTPUT, `build_number=${resolved.value}\n`);
  io.stdout(`Build number: ${resolved.value}`);
  return DONE;
}

/** @type {Command} */
function planReleaseCommand(args, io) {
  const tagsFile = requireArgument(args, 'plan-release <remote-tags-file>');
  if (!tagsFile.ok) return tagsFile;
  const target = requireEnv(io.env, ['GITHUB_OUTPUT']);
  if (!target.ok) return target;
  const build = requireBuildNumber(io.env);
  if (!build.ok) return build;
  const remoteTags = readInput(io, tagsFile.value);
  if (!remoteTags.ok) return remoteTags;
  const plan = planRelease({ buildNumber: build.value, remoteTags: remoteTags.value });
  const output = target.value.GITHUB_OUTPUT;
  if (plan.kind === 'publish') {
    io.appendFile(
      output,
      `publish=true\ntag=${plan.tag}\ntitle=${plan.title}\nasset_name=${plan.assetName}\n`,
    );
  } else {
    io.appendFile(output, 'publish=false\n');
    io.stdout(
      plan.kind === 'alreadyPublished'
        ? `::notice::${plan.tag} is already published (re-run); nothing to publish.`
        : `::warning::Build ${build.value} is older than the published build ${plan.latestBuild}; not publishing it.`,
    );
  }
  return DONE;
}

/** @type {Command} */
function releaseNotes(args, io) {
  const notesFile = requireArgument(args, 'release-notes <output-file>');
  if (!notesFile.ok) return notesFile;
  const build = requireBuildNumber(io.env);
  if (!build.ok) return build;
  const github = requireEnv(io.env, [
    'GITHUB_SHA',
    'GITHUB_SERVER_URL',
    'GITHUB_REPOSITORY',
    'GITHUB_RUN_ID',
  ]);
  if (!github.ok) return github;
  const { GITHUB_SHA, GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = github.value;
  const notes = formatReleaseNotes({
    buildNumber: build.value,
    commitSha: GITHUB_SHA,
    commitSubject: io.env.COMMIT_SUBJECT ?? '',
    runUrl: `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`,
  });
  io.writeFile(notesFile.value, notes);
  return DONE;
}

/** @type {Command} */
function verifyCertificate(args, io) {
  const certsFile = requireArgument(args, 'verify-certificate <apksigner-output-file>');
  if (!certsFile.ok) return certsFile;
  const expected = requireEnv(io.env, [CERTIFICATE_FINGERPRINT_VARIABLE]);
  if (!expected.ok) return expected;
  const certificates = readInput(io, certsFile.value);
  if (!certificates.ok) return certificates;
  const verified = verifySigningCertificate(
    certificates.value,
    expected.value[CERTIFICATE_FINGERPRINT_VARIABLE],
  );
  if (!verified.ok) return verified;
  io.stdout(`Signed with the expected certificate ${verified.value}.`);
  return DONE;
}

/** @type {Command} */
function verifyApk(args, io) {
  const badgingFile = requireArgument(args, 'verify-apk <aapt2-badging-file>');
  if (!badgingFile.ok) return badgingFile;
  const build = requireBuildNumber(io.env);
  if (!build.ok) return build;
  const badging = readInput(io, badgingFile.value);
  if (!badging.ok) return badging;
  const verified = verifyApkBadging(badging.value, {
    packageName: io.appConfig.android.package,
    versionCode: build.value,
    versionName: io.appConfig.version,
    requiredPermissions: [INSTALL_PACKAGES_PERMISSION],
  });
  if (!verified.ok) return verified;
  io.stdout(`APK identity verified (versionCode ${build.value}).`);
  return DONE;
}

/** @type {Readonly<Record<string, Command>>} */
const COMMANDS = Object.freeze({
  'check-release-settings': checkReleaseSettings,
  'build-number': buildNumber,
  'plan-release': planReleaseCommand,
  'release-notes': releaseNotes,
  'verify-certificate': verifyCertificate,
  'verify-apk': verifyApk,
});

/**
 * @param {readonly string[]} argv command name followed by its arguments
 * @param {CliIo} io
 * @returns {number} process exit code
 */
function run(argv, io) {
  const [name = '', ...args] = argv;
  const command = Object.hasOwn(COMMANDS, name) ? COMMANDS[name] : undefined;
  if (command === undefined) {
    io.stderr(
      `::error::Unknown command "${name}". Known commands: ${Object.keys(COMMANDS).join(', ')}.`,
    );
    return EXIT_FAILURE;
  }
  const outcome = command(args, io);
  if (!outcome.ok) {
    io.stderr(`::error::${outcome.error}`);
    return EXIT_FAILURE;
  }
  return EXIT_OK;
}

module.exports = { run };
