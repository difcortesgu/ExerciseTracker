import type {
  EnsureLibrarySeeded,
  LibrarySeedReport,
} from '@modules/exercises/application/ensure-library-seeded';
import type { LibrarySeedError } from '@modules/exercises/application/library-errors';
import { err, ok, type Result } from '@shared/domain/result';

const UP_TO_DATE: LibrarySeedReport = Object.freeze({ kind: 'upToDate', seedVersion: 1 });

/**
 * Stub of the `EnsureLibrarySeeded` use case for other use-case tests (it is a function): answers
 * an up-to-date library, or the arranged seeding error, and counts calls.
 */
export class EnsureLibrarySeededStub {
  private outcome: Result<LibrarySeedReport, LibrarySeedError> = ok(UP_TO_DATE);
  private count = 0;

  readonly ensure: EnsureLibrarySeeded = () => {
    this.count += 1;
    return Promise.resolve(this.outcome);
  };

  get calls(): number {
    return this.count;
  }

  failWith(error: LibrarySeedError): this {
    this.outcome = err(error);
    return this;
  }
}

/** An already seeded library. */
export const seededLibrary = (): EnsureLibrarySeeded => new EnsureLibrarySeededStub().ensure;

/** Seeding that fails with `error`. */
export const failedSeeding = (error: LibrarySeedError): EnsureLibrarySeeded =>
  new EnsureLibrarySeededStub().failWith(error).ensure;
