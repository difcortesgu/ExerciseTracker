import { describePhotoPickerContract } from '@test/contracts/exercises/photo-picker.contract';

import { FakePhotoPicker } from './fake-photo-picker';

describePhotoPickerContract('FakePhotoPicker', () => {
  const picker = new FakePhotoPicker();
  return {
    picker,
    givenPicked: (photo) => picker.respondWith(photo),
    givenCancelled: () => picker.cancel(),
    givenPermissionDenied: (source) => picker.denyPermission(source),
    givenPickerFails: () => picker.fail(),
  };
});

describe('FakePhotoPicker', () => {
  it('returns a default photo and records the sources asked for', async () => {
    const picker = new FakePhotoPicker();

    const result = await picker.pick('camera');

    expect(result).toMatchObject({
      ok: true,
      value: { uri: expect.stringMatching(/^file:/) as unknown },
    });
    expect(picker.requestedSources).toEqual(['camera']);
  });

  it('denies one source while the other still works', async () => {
    const picker = new FakePhotoPicker();
    picker.denyPermission('camera');

    expect((await picker.pick('library')).ok).toBe(true);
  });
});
