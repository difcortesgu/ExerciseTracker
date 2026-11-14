import { createToken } from '@shared/application/di/token';
import type { DomainError } from '@shared/domain/domain-error';
import type { Result } from '@shared/domain/result';

import type { PublishedRelease } from '../domain/release';

/** Every way fetching the latest release can fail (S05-07). */
export type ReleaseSourceErrorCode =
  /** HTTP 404: the repository has no published release yet. */
  | 'updates.noPublishedRelease'
  /** HTTP 403 or 429: GitHub's unauthenticated rate limit (60 requests/hour per IP). */
  | 'updates.rateLimited'
  /** Any other non-2xx status (details carry the status). */
  | 'updates.httpError'
  /** The request could not be sent or the connection dropped (offline, DNS, TLS). */
  | 'updates.networkUnavailable'
  /** No complete answer within `RELEASE_CHECK_TIMEOUT_MS`; the request was abandoned. */
  | 'updates.timeout'
  /** The body is not JSON, or JSON of the wrong shape. */
  | 'updates.malformedResponse';

export type ReleaseSourceError = DomainError<ReleaseSourceErrorCode>;

/**
 * Port: where the latest published release comes from (GitHub Releases in production).
 *
 * Contract (shared contract suite, run against the in-memory fake and the GitHub adapter with the
 * HTTP boundary stubbed):
 * - resolves with the newest **published** release (never a draft or pre-release);
 * - every failure is an `err` with one of `ReleaseSourceErrorCode`; it never rejects or throws;
 * - performs exactly one request per call, unauthenticated, with a timeout.
 * Validation of the release content (tag, assets, URL) is not the source's job: that is
 * `parseRelease` in the domain.
 */
export interface ReleaseSource {
  fetchLatestRelease(): Promise<Result<PublishedRelease, ReleaseSourceError>>;
}

export const ReleaseSourceToken = createToken<ReleaseSource>('updates.ReleaseSource');
