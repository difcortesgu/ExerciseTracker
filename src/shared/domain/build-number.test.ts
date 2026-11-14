import * as fc from 'fast-check';

import { MAX_ANDROID_VERSION_CODE, parseBuildNumber } from './build-number';

describe('parseBuildNumber', () => {
  it('uses the highest versionCode Android accepts as the upper limit', () => {
    expect(MAX_ANDROID_VERSION_CODE).toBe(2_100_000_000);
  });

  it.each([1, 42, MAX_ANDROID_VERSION_CODE])('accepts the whole number %d', (raw) => {
    const result = parseBuildNumber(raw);

    expect(result).toEqual({ ok: true, value: raw });
  });

  it('accepts every whole number from 1 to the Android maximum', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: MAX_ANDROID_VERSION_CODE }), (raw) => {
        expect(parseBuildNumber(raw)).toEqual({ ok: true, value: raw });
      }),
    );
  });

  it.each([
    0,
    -1,
    1.5,
    MAX_ANDROID_VERSION_CODE + 1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])('rejects %d with shared.invalidBuildNumber', (raw) => {
    const result = parseBuildNumber(raw);

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'shared.invalidBuildNumber',
        message: expect.stringContaining('build number') as unknown,
        details: { value: raw },
      },
    });
  });
});
