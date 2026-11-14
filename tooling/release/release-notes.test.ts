import { formatReleaseNotes } from './release-notes';

const BASE = {
  buildNumber: 42,
  commitSha: '0123456789abcdef0123456789abcdef01234567',
  commitSubject: 'Add the update dialog',
  runUrl: 'https://github.com/difcortesgu/ExerciseTracker/actions/runs/99',
};

describe('formatReleaseNotes (S05-03)', () => {
  it('contains the full commit SHA the release was built from', () => {
    expect(formatReleaseNotes(BASE)).toContain(BASE.commitSha);
  });

  it("contains the commit's subject line", () => {
    expect(formatReleaseNotes(BASE)).toContain('Add the update dialog');
  });

  it('names the build and links the workflow run that produced it', () => {
    const notes = formatReleaseNotes(BASE);

    expect(notes).toContain('Build 42');
    expect(notes).toContain(BASE.runUrl);
  });

  it('keeps only the first line of a multi-line commit message', () => {
    const notes = formatReleaseNotes({ ...BASE, commitSubject: 'Subject\n\nLong body text' });

    expect(notes).toContain('Subject');
    expect(notes).not.toContain('Long body text');
  });

  it('says so when the subject is empty instead of leaving a blank line', () => {
    expect(formatReleaseNotes({ ...BASE, commitSubject: '  ' })).toContain('(no commit subject)');
  });
});
