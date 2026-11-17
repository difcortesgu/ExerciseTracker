import type {
  OfflineImages,
  OfflineImagesState,
} from '@modules/exercises/application/offline-images';

import { defineContract } from './contract-harness';

/** Size every arranged image has, so the estimate is predictable in every implementation. */
export const CONTRACT_IMAGE_SIZE_BYTES = 1_000;

/** The bulk-download service plus a way to arrange the library and the "network". */
export interface OfflineImagesFixture {
  readonly service: OfflineImages;
  /** `cached` images are already on the phone, `missing` are not; `failing` of the missing fail. */
  givenImages(images: { cached: number; missing: number; failing?: number }): void;
  /** Downloads stay in flight until `releaseDownloads()` (to observe `running` and cancel). */
  holdDownloads(): void;
  releaseDownloads(): void;
}

type Status = OfflineImagesState['status'];

/** Resolves with the first state of `status` (the current one if it already matches). */
export function stateReached<S extends Status>(
  service: OfflineImages,
  status: S,
): Promise<Extract<OfflineImagesState, { status: S }>> {
  return new Promise((resolve) => {
    const matches = (
      state: OfflineImagesState,
    ): state is Extract<OfflineImagesState, { status: S }> => state.status === status;
    const current = service.getState();
    if (matches(current)) {
      resolve(current);
      return;
    }
    const unsubscribe = service.subscribe((state) => {
      if (matches(state)) {
        unsubscribe();
        resolve(state);
      }
    });
  });
}

function recordStates(service: OfflineImages): OfflineImagesState[] {
  const seen: OfflineImagesState[] = [];
  service.subscribe((state) => seen.push(state));
  return seen;
}

/** Contract of the "Download all images" service (S1-28): the real service and its fake. */
export const describeOfflineImagesContract = defineContract<OfflineImagesFixture>(
  'OfflineImages',
  (fixture) => {
    it('is idle and never starts by itself, not even when estimating', async () => {
      fixture().givenImages({ cached: 0, missing: 3 });

      await fixture().service.estimate();

      expect(fixture().service.getState()).toEqual({ status: 'idle' });
    });

    it('estimates the missing images, their total size and the total count', async () => {
      fixture().givenImages({ cached: 2, missing: 3 });

      const estimate = await fixture().service.estimate();

      expect(estimate).toEqual({
        ok: true,
        value: { missingCount: 3, missingBytes: 3 * CONTRACT_IMAGE_SIZE_BYTES, totalCount: 5 },
      });
    });

    it('downloads every missing image and reports preparing, running and finished', async () => {
      fixture().givenImages({ cached: 1, missing: 3 });
      const seen = recordStates(fixture().service);

      fixture().service.start();
      const finished = await stateReached(fixture().service, 'finished');

      expect(finished).toEqual({
        status: 'finished',
        succeeded: 3,
        failed: 0,
        stoppedEarly: false,
      });
      expect(seen[0]).toEqual({ status: 'preparing' });
      expect(seen).toContainEqual({ status: 'running', completed: 0, failed: 0, total: 3 });
      expect(seen).toContainEqual({ status: 'running', completed: 3, failed: 0, total: 3 });
    });

    it('never notifies the same state twice in a row', async () => {
      fixture().givenImages({ cached: 0, missing: 2 });
      const seen = recordStates(fixture().service);

      fixture().service.start();
      await stateReached(fixture().service, 'finished');

      seen.slice(1).forEach((state, index) => expect(state).not.toEqual(seen[index]));
    });

    it('keeps getState stable between changes', async () => {
      fixture().givenImages({ cached: 0, missing: 1 });
      fixture().service.start();
      await stateReached(fixture().service, 'finished');

      expect(fixture().service.getState()).toBe(fixture().service.getState());
    });

    it('runs one download at a time: start while running is ignored', async () => {
      fixture().givenImages({ cached: 0, missing: 2 });
      fixture().holdDownloads();

      fixture().service.start();
      await stateReached(fixture().service, 'running');
      fixture().service.start();
      fixture().releaseDownloads();

      expect(await stateReached(fixture().service, 'finished')).toMatchObject({ succeeded: 2 });
    });

    it('skips cached images, so a second run downloads nothing', async () => {
      fixture().givenImages({ cached: 0, missing: 2 });
      fixture().service.start();
      await stateReached(fixture().service, 'finished');

      const estimate = await fixture().service.estimate();
      fixture().service.start();
      await stateReached(fixture().service, 'preparing');
      const second = await stateReached(fixture().service, 'finished');

      expect(estimate).toMatchObject({ ok: true, value: { missingCount: 0, missingBytes: 0 } });
      expect(second).toEqual({ status: 'finished', succeeded: 0, failed: 0, stoppedEarly: false });
    });

    it('counts failed images in the summary', async () => {
      fixture().givenImages({ cached: 0, missing: 3, failing: 1 });

      fixture().service.start();

      expect(await stateReached(fixture().service, 'finished')).toEqual({
        status: 'finished',
        succeeded: 2,
        failed: 1,
        stoppedEarly: false,
      });
    });

    it('stops promptly when cancelled and reports what is left', async () => {
      fixture().givenImages({ cached: 0, missing: 3 });
      fixture().holdDownloads();
      fixture().service.start();
      await stateReached(fixture().service, 'running');

      fixture().service.cancel();
      const cancelled = await stateReached(fixture().service, 'cancelled');
      fixture().releaseDownloads();

      expect(cancelled).toEqual({ status: 'cancelled', succeeded: 0, remaining: 3 });
      expect(await fixture().service.estimate()).toMatchObject({ value: { missingCount: 3 } });
    });

    it('ignores cancel when nothing runs', () => {
      fixture().service.cancel();

      expect(fixture().service.getState()).toEqual({ status: 'idle' });
    });

    it('stops notifying a listener after it unsubscribes', async () => {
      fixture().givenImages({ cached: 0, missing: 1 });
      const listener = jest.fn();
      const unsubscribe = fixture().service.subscribe(listener);

      unsubscribe();
      fixture().service.start();
      await stateReached(fixture().service, 'finished');

      expect(listener).not.toHaveBeenCalled();
    });
  },
);
