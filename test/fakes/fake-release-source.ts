import type {
  ReleaseSource,
  ReleaseSourceError,
  ReleaseSourceErrorCode,
} from '@modules/updates/application/release-source';
import type { PublishedRelease } from '@modules/updates/domain/release';
import { domainError } from '@shared/domain/domain-error';
import { err, ok, type Result } from '@shared/domain/result';

/**
 * Fake `ReleaseSource`: answers what the test arranged (by default "no published release"), never
 * touches the network, and counts the requests it received.
 */
export class FakeReleaseSource implements ReleaseSource {
  private answer: Result<PublishedRelease, ReleaseSourceError> = err(
    domainError('updates.noPublishedRelease', 'Fake: no release published.'),
  );
  private requests = 0;

  get requestCount(): number {
    return this.requests;
  }

  respondWith(release: PublishedRelease): void {
    this.answer = ok(release);
  }

  failWith(code: ReleaseSourceErrorCode): void {
    this.answer = err(domainError(code, `Fake release source failure: ${code}.`));
  }

  fetchLatestRelease(): Promise<Result<PublishedRelease, ReleaseSourceError>> {
    this.requests += 1;
    return Promise.resolve(this.answer);
  }
}
