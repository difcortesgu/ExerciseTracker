import * as fc from 'fast-check';

import { MAX_ANDROID_VERSION_CODE } from '@shared/domain/build-number';
import { aBuildNumber } from '@test/builders/installed-app.builder';
import { aRelease } from '@test/builders/release.builder';

import { decideUpdate } from './update-decision';

const buildNumbers = fc.integer({ min: 1, max: MAX_ANDROID_VERSION_CODE });

describe('decideUpdate', () => {
  it('offers a strictly newer release with its download URL and size', () => {
    const latest = aRelease().forBuild(43).withSize(2048).build();

    const decision = decideUpdate(aBuildNumber(42), latest);

    expect(decision).toEqual({ kind: 'updateAvailable', release: latest });
  });

  it('reports up to date for the same build', () => {
    expect(decideUpdate(aBuildNumber(42), aRelease().forBuild(42).build())).toEqual({
      kind: 'upToDate',
    });
  });

  it('never offers an older build', () => {
    expect(decideUpdate(aBuildNumber(43), aRelease().forBuild(42).build())).toEqual({
      kind: 'upToDate',
    });
  });

  it('offers an update if and only if the release is newer than the installed build', () => {
    fc.assert(
      fc.property(buildNumbers, buildNumbers, (installed, latest) => {
        const decision = decideUpdate(aBuildNumber(installed), aRelease().forBuild(latest).build());

        expect(decision.kind === 'updateAvailable').toBe(latest > installed);
      }),
    );
  });

  it('returns an immutable decision', () => {
    const decision = decideUpdate(aBuildNumber(1), aRelease().forBuild(2).build());

    expect(Object.isFrozen(decision)).toBe(true);
  });
});
