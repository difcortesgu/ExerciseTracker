/**
 * Where the self-updater looks for releases (Sprint 0.5, ADR-003 §5). Configuration, read only by
 * the composition root; the adapter receives it through its constructor.
 */

export interface GitHubRepository {
  readonly owner: string;
  readonly name: string;
}

/** The public repository CI publishes "Build <n>" releases to. */
export const GITHUB_RELEASE_REPOSITORY: GitHubRepository = Object.freeze({
  owner: 'difcortesgu',
  name: 'ExerciseTracker',
});

/** How long the startup check waits for GitHub before giving up (ADR-003 §9). */
export const RELEASE_CHECK_TIMEOUT_MS = 10_000;
