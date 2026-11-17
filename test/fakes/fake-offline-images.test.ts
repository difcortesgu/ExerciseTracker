import { domainError } from '@shared/domain/domain-error';
import {
  CONTRACT_IMAGE_SIZE_BYTES,
  describeOfflineImagesContract,
  stateReached,
} from '@test/contracts/offline-images.contract';

import { FakeOfflineImages } from './fake-offline-images';

describeOfflineImagesContract('FakeOfflineImages', () => {
  const service = new FakeOfflineImages();
  return {
    service,
    givenImages: ({ cached, missing, failing = 0 }) =>
      service.givenImages({ cached, missing, failing, sizeBytes: CONTRACT_IMAGE_SIZE_BYTES }),
    holdDownloads: () => service.holdDownloads(),
    releaseDownloads: () => service.releaseDownloads(),
  };
});

describe('FakeOfflineImages', () => {
  it('has no images until a test arranges some', async () => {
    expect(await new FakeOfflineImages().estimate()).toEqual({
      ok: true,
      value: { missingCount: 0, missingBytes: 0, totalCount: 0 },
    });
  });

  it('arranges the exact numbers a screen test wants to show', async () => {
    const service = new FakeOfflineImages();
    service.givenImages({ cached: 0, missing: 1_746, sizeBytes: 56_513 });

    expect(await service.estimate()).toMatchObject({
      value: { missingCount: 1_746, missingBytes: 1_746 * 56_513 },
    });
  });

  it('answers the estimate with an arranged failure', async () => {
    const service = new FakeOfflineImages();
    const failure = domainError('exercises.seedFailed', 'Seeding failed.');

    service.failEstimateWith(failure);

    expect(await service.estimate()).toEqual({ ok: false, error: failure });
  });

  it('shows any arranged state and notifies listeners (screen tests)', () => {
    const service = new FakeOfflineImages();
    const listener = jest.fn();
    service.subscribe(listener);

    service.showState({ status: 'running', completed: 250, failed: 0, total: 1_512 });

    expect(service.getState()).toEqual({
      status: 'running',
      completed: 250,
      failed: 0,
      total: 1_512,
    });
    expect(listener).toHaveBeenCalledWith(service.getState());
  });

  it('counts start and cancel calls', async () => {
    const service = new FakeOfflineImages();

    service.start();
    await stateReached(service, 'finished');
    service.cancel();

    expect(service.startCalls).toBe(1);
    expect(service.cancelCalls).toBe(1);
  });
});

describe('FakeOfflineImages cancellation', () => {
  it('keeps the images finished before a cancel', async () => {
    const service = new FakeOfflineImages();
    service.givenImages({ cached: 0, missing: 3, sizeBytes: 1 });
    service.holdDownloads();
    service.start();
    await stateReached(service, 'running');

    service.releaseDownloads();
    service.holdDownloads();
    await new Promise((resolve) => setImmediate(resolve));
    service.cancel();

    expect(service.getState()).toEqual({ status: 'cancelled', succeeded: 1, remaining: 2 });
    expect(await service.estimate()).toMatchObject({ value: { missingCount: 2, totalCount: 3 } });
  });
});
