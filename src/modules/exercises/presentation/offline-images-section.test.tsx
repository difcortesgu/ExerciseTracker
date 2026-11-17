import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import { createContainer } from '@core/di/container';
import { err, type Result } from '@shared/domain/result';
import { FakeOfflineImages } from '@test/fakes/fake-offline-images';
import { storageFailed, withContainer } from '@test/support/exercise-screen-harness';

import type { ExerciseLibraryError } from '../application/library-errors';
import {
  OfflineImagesToken,
  type OfflineImages,
  type OfflineImagesEstimate,
} from '../application/offline-images';

import { OfflineImagesSection } from './offline-images-section';

const FULL_LIBRARY = { cached: 0, missing: 1746, sizeBytes: 56_512 } as const;
const KEEP_APP_OPEN =
  'Keep the app open until the download finishes. Images downloaded so far are kept.';

type EstimateResult = Result<OfflineImagesEstimate, ExerciseLibraryError>;

/** The fake service with its `estimate()` answered by `answers` first (pending ones never settle). */
function withEstimates(
  service: FakeOfflineImages,
  ...answers: readonly (EstimateResult | 'pending')[]
): OfflineImages {
  const queue = [...answers];
  return {
    estimate: () => {
      const answer = queue.shift();
      if (answer === undefined) return service.estimate();
      return answer === 'pending'
        ? new Promise<EstimateResult>(() => undefined)
        : Promise.resolve(answer);
    },
    start: () => service.start(),
    cancel: () => service.cancel(),
    getState: () => service.getState(),
    subscribe: (listener) => service.subscribe(listener),
  };
}

function aService(images: Parameters<FakeOfflineImages['givenImages']>[0] = FULL_LIBRARY) {
  const service = new FakeOfflineImages();
  service.givenImages(images);
  return service;
}

async function renderSection(service: OfflineImages) {
  const container = createContainer().register(OfflineImagesToken, () => service);
  await render(<OfflineImagesSection />, { wrapper: withContainer(container) });
}

const downloadAllButton = () => screen.queryByRole('button', { name: 'Download all images' });

describe('OfflineImagesSection (S1-28)', () => {
  it('is a section titled "Offline images"', async () => {
    await renderSection(aService());

    expect(screen.getByRole('header', { name: 'Offline images' })).toBeOnTheScreen();
  });

  describe('before a download', () => {
    it('shows a loading state while it checks which images are missing', async () => {
      await renderSection(withEstimates(aService(), 'pending'));

      expect(screen.getByLabelText('Checking offline images')).toBeOnTheScreen();
      expect(downloadAllButton()).toBeNull();
    });

    it('shows an error with Retry when the check fails, and checks again on Retry', async () => {
      await renderSection(withEstimates(aService(), err(storageFailed)));
      const error = screen.getByLabelText("Couldn't check offline images");
      expect(error).toHaveTextContent(/could not be read or saved/);

      await act(async () => fireEvent.press(within(error).getByRole('button', { name: 'Retry' })));

      expect(screen.queryByLabelText("Couldn't check offline images")).toBeNull();
      expect(downloadAllButton()).toBeOnTheScreen();
    });

    it('says how many images are missing and offers the download', async () => {
      await renderSection(aService({ cached: 250, missing: 1496, sizeBytes: 1 }));

      expect(
        screen.getByText('1 496 of 1 746 images are not on this phone yet.'),
      ).toBeOnTheScreen();
      expect(downloadAllButton()).toBeOnTheScreen();
    });

    it('offers no download when every image is already available offline', async () => {
      await renderSection(aService({ cached: 1746, missing: 0, sizeBytes: 1 }));

      expect(screen.getByText('All images are available offline')).toBeOnTheScreen();
      expect(downloadAllButton()).toBeNull();
    });

    it('never starts a download by itself', async () => {
      const service = aService();

      await renderSection(service);

      expect(service.startCalls).toBe(0);
    });
  });

  describe('confirmation', () => {
    it('states the missing count and estimated size before anything is downloaded', async () => {
      const service = aService();
      await renderSection(service);

      await act(async () =>
        fireEvent.press(screen.getByRole('button', { name: 'Download all images' })),
      );

      const dialog = screen.getByTestId('dialog');
      expect(
        within(dialog).getByText('1 746 images, about 99 MB. Use Wi-Fi if you can.'),
      ).toBeOnTheScreen();
      expect(within(dialog).getByRole('button', { name: 'Download' })).toBeOnTheScreen();
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();
      expect(service.startCalls).toBe(0);
    });

    it('starts the download when confirmed', async () => {
      const service = aService();
      service.holdDownloads();
      await renderSection(service);
      await act(async () =>
        fireEvent.press(screen.getByRole('button', { name: 'Download all images' })),
      );

      await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Download' })));

      expect(service.startCalls).toBe(1);
      expect(screen.queryByTestId('dialog')).toBeNull();
      expect(screen.getByLabelText('Image download progress, 0 of 1 746')).toBeOnTheScreen();
    });

    it('downloads nothing when cancelled', async () => {
      const service = aService();
      await renderSection(service);
      await act(async () =>
        fireEvent.press(screen.getByRole('button', { name: 'Download all images' })),
      );

      await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Cancel' })));

      expect(service.startCalls).toBe(0);
      expect(screen.queryByTestId('dialog')).toBeNull();
    });
  });

  describe('while downloading', () => {
    it('says it is preparing the download', async () => {
      const service = aService();
      await renderSection(service);

      await act(async () => service.showState({ status: 'preparing' }));

      expect(screen.getByLabelText('Preparing the download')).toBeOnTheScreen();
      expect(downloadAllButton()).toBeNull();
    });

    it('shows the progress as "n of total" with an announced progress bar', async () => {
      const service = aService();
      await renderSection(service);

      await act(async () =>
        service.showState({ status: 'running', completed: 248, failed: 2, total: 1512 }),
      );

      const bar = screen.getByRole('progressbar', {
        name: 'Image download progress, 250 of 1 512',
      });
      expect(bar).toHaveAccessibilityValue({ min: 0, max: 1512, now: 250 });
      expect(screen.getByText('250 of 1 512')).toBeOnTheScreen();
      expect(downloadAllButton()).toBeNull();
    });

    it('asks to keep the app open, because the download does not continue in the background', async () => {
      const service = aService();
      await renderSection(service);

      await act(async () =>
        service.showState({ status: 'running', completed: 1, failed: 0, total: 2 }),
      );

      expect(screen.getByText(KEEP_APP_OPEN)).toBeOnTheScreen();
    });

    it('cancels the download', async () => {
      const service = aService({ cached: 0, missing: 3, sizeBytes: 1 });
      service.holdDownloads();
      await renderSection(service);
      await act(async () =>
        fireEvent.press(screen.getByRole('button', { name: 'Download all images' })),
      );
      await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Download' })));

      await act(async () =>
        fireEvent.press(screen.getByRole('button', { name: 'Cancel download' })),
      );

      expect(service.cancelCalls).toBe(1);
      expect(
        screen.getByText('Download cancelled. 0 images downloaded, 3 still missing.'),
      ).toBeOnTheScreen();
    });
  });

  describe('after a download', () => {
    it('confirms a complete download and that every image is available offline', async () => {
      const service = aService({ cached: 0, missing: 2, sizeBytes: 1 });
      await renderSection(service);
      await act(async () =>
        fireEvent.press(screen.getByRole('button', { name: 'Download all images' })),
      );

      await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Download' })));

      expect(screen.getByText('2 images downloaded.')).toBeOnTheScreen();
      expect(screen.getByText('All images are available offline')).toBeOnTheScreen();
      expect(downloadAllButton()).toBeNull();
    });

    it('summarises failures and retries only the failed images', async () => {
      const service = aService({ cached: 0, missing: 3, failing: 1, sizeBytes: 1 });
      await renderSection(service);
      await act(async () =>
        fireEvent.press(screen.getByRole('button', { name: 'Download all images' })),
      );
      await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Download' })));
      expect(screen.getByText('2 images downloaded, 1 failed.')).toBeOnTheScreen();
      expect(downloadAllButton()).toBeNull();

      await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Retry failed' })));

      expect(service.startCalls).toBe(2);
    });

    it('explains a run that stopped because the connection seems lost', async () => {
      const service = aService();
      await renderSection(service);

      await act(async () =>
        service.showState({ status: 'finished', succeeded: 40, failed: 1706, stoppedEarly: true }),
      );

      expect(
        screen.getByText(
          '40 images downloaded, 1 706 failed. The download stopped because the connection seems lost.',
        ),
      ).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Retry failed' })).toBeOnTheScreen();
    });

    it('lets the user resume a cancelled download', async () => {
      const service = aService({ cached: 0, missing: 3, sizeBytes: 1 });
      await renderSection(service);

      await act(async () => service.showState({ status: 'cancelled', succeeded: 1, remaining: 2 }));

      expect(downloadAllButton()).toBeOnTheScreen();
    });
  });
});
