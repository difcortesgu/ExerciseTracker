import * as fc from 'fast-check';

import { MAX_ANDROID_VERSION_CODE } from '@shared/domain/build-number';
import { aPublishedAsset, aPublishedRelease } from '@test/builders/release.builder';
import { unwrap } from '@test/support/unwrap';

import {
  apkFileNameForBuild,
  MAX_ANDROID_VERSION_CODE as CI_MAX_ANDROID_VERSION_CODE,
  parseBuildTag,
  RELEASE_TAG_PREFIX as CI_RELEASE_TAG_PREFIX,
  tagForBuild,
} from '../../../../tooling/release/release-format';

import { parseRelease, RELEASE_TAG_PREFIX } from './release';

/**
 * The release format exists twice (ADR-003 §5): CI publishes with tooling/release/release-format.js,
 * the app reads with `parseRelease`. These tests fail as soon as the two drift apart, so a release
 * that CI publishes is always one the app accepts, with the same build number.
 */

const buildNumbers = fc.integer({ min: 1, max: MAX_ANDROID_VERSION_CODE });

const releasePublishedByCi = (build: number) =>
  aPublishedRelease()
    .withTag(tagForBuild(build))
    .withAssets(
      aPublishedAsset({
        name: apkFileNameForBuild(build),
        downloadUrl: `https://github.com/difcortesgu/ExerciseTracker/releases/download/${tagForBuild(build)}/${apkFileNameForBuild(build)}`,
      }),
    )
    .build();

describe('release format shared by CI and the app (ADR-003 §5)', () => {
  it('uses the same tag prefix and Android maximum on both sides', () => {
    expect(CI_RELEASE_TAG_PREFIX).toBe(RELEASE_TAG_PREFIX);
    expect(CI_MAX_ANDROID_VERSION_CODE).toBe(MAX_ANDROID_VERSION_CODE);
  });

  it('accepts every release CI can publish, with the build number CI gave it', () => {
    fc.assert(
      fc.property(buildNumbers, (build) => {
        const release = unwrap(parseRelease(releasePublishedByCi(build)));

        expect(release.buildNumber).toBe(build);
        expect(release.apk.name).toBe(apkFileNameForBuild(build));
      }),
    );
  });

  it.each([
    'build-1',
    'build-42',
    `build-${MAX_ANDROID_VERSION_CODE}`,
    'build-0',
    'build-01',
    `build-${MAX_ANDROID_VERSION_CODE + 1}`,
    'Build-42',
    'build-42 ',
    'build--1',
    'build-4.2',
    'build-1e3',
    'v42',
    '42',
    '',
  ])('agrees with CI on whether %j is a build tag', (tag) => {
    const ciBuild = parseBuildTag(tag);
    const appRelease = parseRelease(aPublishedRelease().withTag(tag).build());

    expect(appRelease.ok ? appRelease.value.buildNumber : null).toBe(ciBuild);
  });
});
