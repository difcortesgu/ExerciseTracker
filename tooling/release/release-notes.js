// @ts-check
/** Release notes of a CI release (S05-03): build, commit SHA, commit subject, workflow run. */
const { titleForBuild } = require('./release-format');

const NO_SUBJECT = '(no commit subject)';

/**
 * @param {{ buildNumber: number, commitSha: string, commitSubject: string, runUrl: string }} input
 * @returns {string} Markdown release notes
 */
function formatReleaseNotes({ buildNumber, commitSha, commitSubject, runUrl }) {
  const subject = commitSubject.split('\n')[0]?.trim() || NO_SUBJECT;
  return [
    `${titleForBuild(buildNumber)} of Exercise Tracker.`,
    '',
    `- Commit: ${commitSha}`,
    `- Subject: ${subject}`,
    `- Built by: ${runUrl}`,
    '',
  ].join('\n');
}

module.exports = { formatReleaseNotes };
