import { act, renderHook } from '@testing-library/react-native';

import { createContainer } from '@core/di/container';
import { err } from '@shared/domain/result';
import { FakeOfflineImages } from '@test/fakes/fake-offline-images';
import { storageFailed, withContainer } from '@test/support/exercise-screen-harness';

import { OfflineImagesToken, type OfflineImages } from '../application/offline-images';

import { useOfflineImages } from './use-offline-images';

const IMAGE_BYTES = 56_500;

function aServiceWith(images: { cached: number; missing: number; failing?: number }) {
  const service = new FakeOfflineImages();
  service.givenImages({ ...images, sizeBytes: IMAGE_BYTES });
  return service;
}

/** The service, except that its first estimate fails with `storageFailed`. */
function failingFirstEstimate(service: FakeOfflineImages): OfflineImages {
  let calls = 0;
  return {
    estimate: () => {
      calls += 1;
      return calls === 1 ? Promise.resolve(err(storageFailed)) : service.estimate();
    },
    start: () => service.start(),
    cancel: () => service.cancel(),
    getState: () => service.getState(),
    subscribe: (listener) => service.subscribe(listener),
  };
}

async function renderViewModel(service: OfflineImages) {
  const container = createContainer().register(OfflineImagesToken, () => service);
  return renderHook(() => useOfflineImages(), { wrapper: withContainer(container) });
}

describe('useOfflineImages (S1-28)', () => {
  describe('estimate', () => {
    it('loads what a download would fetch, without starting one', async () => {
      const service = aServiceWith({ cached: 250, missing: 1496 });

      const { result } = await renderViewModel(service);

      expect(result.current.estimate).toEqual({
        status: 'loaded',
        value: { missingCount: 1496, missingBytes: 1496 * IMAGE_BYTES, totalCount: 1746 },
      });
      expect(service.startCalls).toBe(0);
      expect(result.current.run).toEqual({ status: 'idle' });
    });

    it('reports a failed estimate and loads it again on request', async () => {
      const service = aServiceWith({ cached: 0, missing: 2 });
      const { result } = await renderViewModel(failingFirstEstimate(service));
      expect(result.current.estimate).toEqual({ status: 'failed', error: storageFailed });

      await act(async () => result.current.reloadEstimate());

      expect(result.current.estimate).toEqual({
        status: 'loaded',
        value: { missingCount: 2, missingBytes: 2 * IMAGE_BYTES, totalCount: 2 },
      });
    });
  });

  describe('confirmation', () => {
    it('asks first and downloads nothing before the user confirms', async () => {
      const service = aServiceWith({ cached: 0, missing: 2 });
      const { result } = await renderViewModel(service);

      await act(async () => result.current.requestDownload());

      expect(result.current.isConfirming).toBe(true);
      expect(service.startCalls).toBe(0);
    });

    it('starts one run when the user confirms, and closes the confirmation', async () => {
      const service = aServiceWith({ cached: 0, missing: 2 });
      service.holdDownloads();
      const { result } = await renderViewModel(service);
      await act(async () => result.current.requestDownload());

      await act(async () => result.current.confirmDownload());

      expect(result.current.isConfirming).toBe(false);
      expect(service.startCalls).toBe(1);
      expect(result.current.run).toMatchObject({ status: 'running', total: 2 });
    });

    it('closes without downloading when the user dismisses it', async () => {
      const service = aServiceWith({ cached: 0, missing: 2 });
      const { result } = await renderViewModel(service);
      await act(async () => result.current.requestDownload());

      await act(async () => result.current.dismissConfirmation());

      expect(result.current.isConfirming).toBe(false);
      expect(service.startCalls).toBe(0);
    });
  });

  describe('run', () => {
    it('follows the state of the shared service, including a run started elsewhere', async () => {
      const service = aServiceWith({ cached: 0, missing: 1512 });
      const { result } = await renderViewModel(service);

      await act(async () =>
        service.showState({ status: 'running', completed: 250, failed: 0, total: 1512 }),
      );

      expect(result.current.run).toEqual({
        status: 'running',
        completed: 250,
        failed: 0,
        total: 1512,
      });
    });

    it('cancels the running download', async () => {
      const service = aServiceWith({ cached: 0, missing: 3 });
      service.holdDownloads();
      const { result } = await renderViewModel(service);
      await act(async () => result.current.confirmDownload());

      await act(async () => result.current.cancelDownload());

      expect(service.cancelCalls).toBe(1);
      expect(result.current.run).toEqual({ status: 'cancelled', succeeded: 0, remaining: 3 });
    });

    it('retries the failed images by starting again', async () => {
      const service = aServiceWith({ cached: 0, missing: 3, failing: 1 });
      const { result } = await renderViewModel(service);
      await act(async () => result.current.confirmDownload());
      expect(result.current.run).toEqual({
        status: 'finished',
        succeeded: 2,
        failed: 1,
        stoppedEarly: false,
      });

      await act(async () => result.current.retryFailed());

      expect(service.startCalls).toBe(2);
    });

    it('refreshes the estimate when a run ends, so the section shows what is still missing', async () => {
      const service = aServiceWith({ cached: 0, missing: 3 });
      const { result } = await renderViewModel(service);

      await act(async () => result.current.confirmDownload());

      expect(result.current.run).toMatchObject({ status: 'finished', succeeded: 3 });
      expect(result.current.estimate).toEqual({
        status: 'loaded',
        value: { missingCount: 0, missingBytes: 0, totalCount: 3 },
      });
    });
  });
});
