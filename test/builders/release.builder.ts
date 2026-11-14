import {
  parseRelease,
  type PublishedRelease,
  type PublishedReleaseAsset,
  type Release,
} from '@modules/updates/domain/release';

import { unwrap } from '../support/unwrap';

/**
 * Builders for GitHub releases (Sprint 0.5). Defaults follow the release format of ADR-003
 * (tag `build-<n>`, one asset `exercise-tracker-build-<n>.apk` on github.com), so `build()` is
 * valid unless a test overrides a field. `aRelease()` goes through `parseRelease` (no casts).
 */

const DEFAULT_BUILD = 42;
const DEFAULT_APK_SIZE_BYTES = 31_457_280;
const RELEASES_DOWNLOAD_BASE = 'https://github.com/difcortesgu/ExerciseTracker/releases/download';

const apkNameFor = (build: number): string => `exercise-tracker-build-${build}.apk`;

const apkAssetFor = (build: number): PublishedReleaseAsset => ({
  name: apkNameFor(build),
  downloadUrl: `${RELEASES_DOWNLOAD_BASE}/build-${build}/${apkNameFor(build)}`,
  sizeBytes: DEFAULT_APK_SIZE_BYTES,
});

/** A plain published asset: the default APK of build 42 with the given fields overridden. */
export const aPublishedAsset = (
  overrides: Partial<PublishedReleaseAsset> = {},
): PublishedReleaseAsset => ({ ...apkAssetFor(DEFAULT_BUILD), ...overrides });

export class PublishedReleaseBuilder {
  constructor(
    private readonly tagName: string,
    private readonly assets: readonly PublishedReleaseAsset[],
  ) {}

  /** Tag and the single APK asset of build `build`. */
  forBuild(build: number): PublishedReleaseBuilder {
    return new PublishedReleaseBuilder(`build-${build}`, [apkAssetFor(build)]);
  }

  withTag(tagName: string): PublishedReleaseBuilder {
    return new PublishedReleaseBuilder(tagName, this.assets);
  }

  /** Overrides fields of the first asset (the APK by default). */
  withApk(overrides: Partial<PublishedReleaseAsset>): PublishedReleaseBuilder {
    const [first = aPublishedAsset(), ...rest] = this.assets;
    return new PublishedReleaseBuilder(this.tagName, [{ ...first, ...overrides }, ...rest]);
  }

  withAssets(...assets: readonly PublishedReleaseAsset[]): PublishedReleaseBuilder {
    return new PublishedReleaseBuilder(this.tagName, assets);
  }

  build(): PublishedRelease {
    return { tagName: this.tagName, assets: this.assets };
  }
}

export const aPublishedRelease = (): PublishedReleaseBuilder =>
  new PublishedReleaseBuilder(`build-${DEFAULT_BUILD}`, [apkAssetFor(DEFAULT_BUILD)]);

export class ReleaseBuilder {
  constructor(private readonly published: PublishedReleaseBuilder) {}

  forBuild(build: number): ReleaseBuilder {
    return new ReleaseBuilder(this.published.forBuild(build));
  }

  withSize(sizeBytes: number): ReleaseBuilder {
    return new ReleaseBuilder(this.published.withApk({ sizeBytes }));
  }

  /** A validated `Release`; throws (failing the test) if the overrides make it invalid. */
  build(): Release {
    return unwrap(parseRelease(this.published.build()));
  }
}

export const aRelease = (): ReleaseBuilder => new ReleaseBuilder(aPublishedRelease());
