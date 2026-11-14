// @ts-check
/**
 * Build number and release plan (S05-01, S05-03; ADR-003 "Build number").
 *
 * Build number = GitHub's `run_number` of the CI workflow (+ an optional repository variable
 * `BUILD_NUMBER_OFFSET`). `run_number` grows with every new run of the workflow and is kept by
 * re-runs, so a cancelled run only leaves a gap. The plan step then refuses to publish a number
 * that is not greater than every published `build-<n>` tag, which also covers re-runs of an old
 * run and a restarted counter.
 */
const {
  MAX_ANDROID_VERSION_CODE,
  apkFileNameForBuild,
  parseBuildNumber,
  parseBuildTag,
  tagForBuild,
  titleForBuild,
} = require('./release-format');

/**
 * @template T
 * @typedef {{ ok: true, value: T } | { ok: false, error: string }} Outcome
 */

const NON_NEGATIVE_WHOLE_NUMBER = /^(0|[1-9]\d*)$/;

/**
 * @param {string | undefined} raw
 * @returns {Outcome<number>}
 */
function parseOffset(raw) {
  if (raw === undefined || raw === '') {
    return { ok: true, value: 0 };
  }
  return NON_NEGATIVE_WHOLE_NUMBER.test(raw)
    ? { ok: true, value: Number(raw) }
    : { ok: false, error: `BUILD_NUMBER_OFFSET must be a whole number >= 0, got "${raw}".` };
}

/**
 * @param {{ runNumber: string | undefined, offset: string | undefined }} input raw values of
 *   GITHUB_RUN_NUMBER and the BUILD_NUMBER_OFFSET repository variable
 * @returns {Outcome<number>}
 */
function resolveBuildNumber({ runNumber, offset }) {
  const run = parseBuildNumber(runNumber ?? '');
  if (run === null) {
    return {
      ok: false,
      error: `GITHUB_RUN_NUMBER must be a whole number >= 1, got "${runNumber}".`,
    };
  }
  const parsedOffset = parseOffset(offset);
  if (!parsedOffset.ok) {
    return parsedOffset;
  }
  const buildNumber = run + parsedOffset.value;
  return buildNumber <= MAX_ANDROID_VERSION_CODE
    ? { ok: true, value: buildNumber }
    : {
        ok: false,
        error: `Build number ${buildNumber} exceeds the Android maximum ${MAX_ANDROID_VERSION_CODE}.`,
      };
}

const TAG_REF = /^\S+\trefs\/tags\/(\S+?)(?:\^\{\})?$/;

/**
 * @param {string} remoteTags output of `git ls-remote --tags origin`
 * @returns {number[]} build numbers of all `build-<n>` tags
 */
function publishedBuildNumbers(remoteTags) {
  return remoteTags
    .split('\n')
    .map((line) => TAG_REF.exec(line.trim())?.[1])
    .map((tag) => (tag === undefined ? null : parseBuildTag(tag)))
    .filter((buildNumber) => buildNumber !== null);
}

/**
 * @typedef {{ kind: 'publish', tag: string, title: string, assetName: string }
 *   | { kind: 'alreadyPublished', tag: string }
 *   | { kind: 'superseded', latestBuild: number }} ReleasePlan
 */

/**
 * Decides whether this run may publish its build (S05-01: no two releases share a number, and the
 * release marked "latest" has the highest one).
 *
 * @param {{ buildNumber: number, remoteTags: string }} input
 * @returns {ReleasePlan}
 */
function planRelease({ buildNumber, remoteTags }) {
  const latestBuild = Math.max(0, ...publishedBuildNumbers(remoteTags));
  if (latestBuild === buildNumber) {
    return { kind: 'alreadyPublished', tag: tagForBuild(buildNumber) };
  }
  if (latestBuild > buildNumber) {
    return { kind: 'superseded', latestBuild };
  }
  return {
    kind: 'publish',
    tag: tagForBuild(buildNumber),
    title: titleForBuild(buildNumber),
    assetName: apkFileNameForBuild(buildNumber),
  };
}

module.exports = { planRelease, resolveBuildNumber };
