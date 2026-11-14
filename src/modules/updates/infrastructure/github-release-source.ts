import { describeCause } from '@shared/domain/describe-cause';
import { domainError } from '@shared/domain/domain-error';
import { err, ok, type Result } from '@shared/domain/result';

import type {
  ReleaseSource,
  ReleaseSourceError,
  ReleaseSourceErrorCode,
} from '../application/release-source';
import type { PublishedRelease } from '../domain/release';

import type { GitHubRepository } from './github-release-config';
import { toPublishedRelease } from './github-release-mapper';

/** The part of a `fetch` response the adapter reads. */
export interface HttpResponse {
  readonly status: number;
  readonly ok: boolean;
  json(): Promise<unknown>;
}

export interface HttpGetOptions {
  readonly headers: Readonly<Record<string, string>>;
  readonly signal: AbortSignal;
}

/** HTTP boundary: the global `fetch` in production (wired by the composition root), a stub in tests. */
export type HttpGet = (url: string, options: HttpGetOptions) => Promise<HttpResponse>;

export interface GitHubReleaseSourceOptions {
  readonly repository: GitHubRepository;
  readonly timeoutMs: number;
  readonly fetch: HttpGet;
}

const GITHUB_API = 'https://api.github.com';
/** Unauthenticated on purpose: the repository is public and no token may ship in the APK. */
const REQUEST_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});
const HTTP_NOT_FOUND = 404;
const RATE_LIMIT_STATUSES: readonly number[] = [403, 429];

type FetchResult = Result<PublishedRelease, ReleaseSourceError>;

function failure(
  code: ReleaseSourceErrorCode,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): FetchResult {
  return err(domainError(code, message, details));
}

function statusFailure(status: number): FetchResult {
  if (status === HTTP_NOT_FOUND) {
    return failure('updates.noPublishedRelease', 'No published release yet.', { status });
  }
  return RATE_LIMIT_STATUSES.includes(status)
    ? failure('updates.rateLimited', 'GitHub rate limit reached.', { status })
    : failure('updates.httpError', `GitHub answered HTTP ${status}.`, { status });
}

/**
 * Adapter (ports & adapters): the `ReleaseSource` port over GitHub's public REST API
 * (`GET /repos/{owner}/{repo}/releases/latest`, which never returns drafts or pre-releases).
 * One request per call, abandoned after `timeoutMs`; every failure is an `err`, it never throws.
 */
export class GitHubReleaseSource implements ReleaseSource {
  constructor(private readonly options: GitHubReleaseSourceOptions) {}

  async fetchLatestRelease(): Promise<FetchResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      return await this.request(controller.signal);
    } catch (cause) {
      return controller.signal.aborted
        ? failure('updates.timeout', 'GitHub did not answer in time.', {
            timeoutMs: this.options.timeoutMs,
          })
        : failure('updates.networkUnavailable', 'GitHub could not be reached.', {
            cause: describeCause(cause),
          });
    } finally {
      clearTimeout(timer);
    }
  }

  private get latestReleaseUrl(): string {
    const { owner, name } = this.options.repository;
    return `${GITHUB_API}/repos/${owner}/${name}/releases/latest`;
  }

  /** Throws only for transport failures (rejected request or body); the caller maps them. */
  private async request(signal: AbortSignal): Promise<FetchResult> {
    const response = await this.options.fetch(this.latestReleaseUrl, {
      headers: REQUEST_HEADERS,
      signal,
    });
    if (!response.ok) {
      return statusFailure(response.status);
    }
    const body = await response.json().catch((cause: unknown) => {
      if (signal.aborted) throw cause;
      return undefined;
    });
    const published = toPublishedRelease(body);
    return published === undefined
      ? failure('updates.malformedResponse', 'The latest release has an unexpected shape.')
      : ok(published);
  }
}
