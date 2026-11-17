import type {
  ExerciseSeedSource,
  SeedDataset,
  SeedManifest,
  SeedSourceError,
} from '@modules/exercises/application/library-seed-ports';
import { domainError } from '@shared/domain/domain-error';
import { err, ok, type Result } from '@shared/domain/result';

/** A manifest like the generated `assets/exercise-db/manifest.json`, at seed version 1. */
export const FAKE_SEED_MANIFEST: SeedManifest = Object.freeze({
  seedVersion: 1,
  source: {
    name: 'free-exercise-db',
    repositoryUrl: 'https://github.com/yuhonas/free-exercise-db',
    commit: 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5',
    licence: { name: 'The Unlicense (public domain)', url: 'https://unlicense.org/' },
  },
  imageBaseUrl: 'https://images.example/exercises/',
  counts: { exercises: 0, images: 0, imageBytes: 0 },
});

/** Fake `ExerciseSeedSource`: the arranged dataset (empty by default) or an arranged failure. */
export class FakeExerciseSeedSource implements ExerciseSeedSource {
  readonly manifest: SeedManifest;
  private content: Omit<SeedDataset, 'seedVersion'> = { exercises: [], vocabulary: [] };
  private failure: string | null = null;
  private loads = 0;

  constructor(overrides: Partial<SeedManifest> = {}) {
    this.manifest = Object.freeze({ ...FAKE_SEED_MANIFEST, ...overrides });
  }

  get loadCount(): number {
    return this.loads;
  }

  givenDataset(content: Omit<SeedDataset, 'seedVersion'>): void {
    this.content = content;
    this.failure = null;
  }

  failWith(reason: string): void {
    this.failure = reason;
  }

  loadDataset(): Promise<Result<SeedDataset, SeedSourceError>> {
    this.loads += 1;
    return Promise.resolve(
      this.failure === null
        ? ok({ seedVersion: this.manifest.seedVersion, ...this.content })
        : err(
            domainError('exercises.seedAssetInvalid', 'The seed is invalid.', {
              reason: this.failure,
            }),
          ),
    );
  }
}
