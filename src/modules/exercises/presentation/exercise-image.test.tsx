import { act, render, screen } from '@testing-library/react-native';

import { aBuiltInImage } from '@test/builders/exercise.builder';
import {
  cachedImageUri,
  exerciseContainer,
  pendingCalls,
  withContainer,
} from '@test/support/exercise-screen-harness';

import type { ExerciseImageRef, ImageSource } from '../application/exercise-dtos';

import { ExerciseImage, IMAGE_UNAVAILABLE_LABEL, NO_IMAGE_LABEL } from './exercise-image';

const squatImage = aBuiltInImage('Barbell_Squat/0.jpg');
const LABEL = 'Barbell Squat, image 1 of 2';

async function renderImage(
  image: ExerciseImageRef | null,
  getExerciseImage?: (image: ExerciseImageRef) => Promise<ImageSource>,
) {
  const container = exerciseContainer(getExerciseImage === undefined ? {} : { getExerciseImage });
  return render(<ExerciseImage image={image} label={LABEL} variant="gallery" />, {
    wrapper: withContainer(container),
  });
}

describe('ExerciseImage (S1-18)', () => {
  it('shows the image from the local file the use case returns, labelled for screen readers', async () => {
    await renderImage(squatImage);

    const image = await screen.findByLabelText(LABEL);
    expect(image.props.source).toEqual([
      expect.objectContaining({ uri: cachedImageUri(squatImage) }),
    ]);
  });

  it('shows a busy placeholder while the image is being fetched', async () => {
    const images = pendingCalls<[ExerciseImageRef], ImageSource>();
    await renderImage(squatImage, images.fn);

    expect(screen.getByLabelText(LABEL)).toBeBusy();
    expect(images.calls[0]?.args).toEqual([squatImage]);
  });

  it('shows the "not available offline" placeholder when the image cannot be shown', async () => {
    await renderImage(squatImage, () => Promise.resolve({ status: 'unavailable' }));

    expect(await screen.findByLabelText(IMAGE_UNAVAILABLE_LABEL)).toBeOnTheScreen();
    expect(IMAGE_UNAVAILABLE_LABEL).toBe('Image not available offline');
    expect(screen.queryByLabelText(LABEL)).not.toBeOnTheScreen();
  });

  it('shows a neutral placeholder without any request when there is no image', async () => {
    const getExerciseImage = jest.fn(() => Promise.resolve<ImageSource>({ status: 'unavailable' }));

    await renderImage(null, getExerciseImage);

    expect(screen.getByLabelText(NO_IMAGE_LABEL)).toBeOnTheScreen();
    expect(getExerciseImage).not.toHaveBeenCalled();
  });

  it('fetches the new image when it is given another one', async () => {
    const other = aBuiltInImage('Barbell_Squat/1.jpg');
    const view = await renderImage(squatImage);
    await screen.findByLabelText(LABEL);

    await view.rerender(<ExerciseImage image={other} label={LABEL} variant="gallery" />);

    await act(async () => undefined);
    expect(screen.getByLabelText(LABEL).props.source).toEqual([
      expect.objectContaining({ uri: cachedImageUri(other) }),
    ]);
  });

  it('keeps a failed thumbnail small: an icon only, labelled for screen readers', async () => {
    const container = exerciseContainer({
      getExerciseImage: () => Promise.resolve({ status: 'unavailable' }),
    });
    await render(<ExerciseImage image={squatImage} label={LABEL} variant="thumbnail" />, {
      wrapper: withContainer(container),
    });

    expect(await screen.findByLabelText(IMAGE_UNAVAILABLE_LABEL)).toBeOnTheScreen();
    expect(screen.queryByText(IMAGE_UNAVAILABLE_LABEL)).not.toBeOnTheScreen();
  });

  it('surfaces a rejected use case (a broken contract) to the error boundary', async () => {
    const silenceReactErrorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      renderImage(squatImage, () => Promise.reject(new Error('cache crashed'))),
    ).rejects.toThrow('cache crashed');

    silenceReactErrorLog.mockRestore();
  });

  it('drops an answer that arrives after the slot was scrolled away (unmounted)', async () => {
    const images = pendingCalls<[ExerciseImageRef], ImageSource>();
    const view = await renderImage(squatImage, images.fn);

    await view.unmount();
    await act(async () => images.calls[0]?.resolve({ status: 'unavailable' }));

    expect(screen.queryByLabelText(IMAGE_UNAVAILABLE_LABEL)).not.toBeOnTheScreen();
  });

  it('tells its parent when the image is not available, so it can offer the bulk download', async () => {
    const onUnavailable = jest.fn();
    const container = exerciseContainer({
      getExerciseImage: () => Promise.resolve({ status: 'unavailable' }),
    });
    await render(
      <ExerciseImage
        image={squatImage}
        label={LABEL}
        variant="gallery"
        onUnavailable={onUnavailable}
      />,
      { wrapper: withContainer(container) },
    );

    await screen.findByLabelText(IMAGE_UNAVAILABLE_LABEL);
    expect(onUnavailable).toHaveBeenCalledTimes(1);
  });

  it('does not report an image that is shown', async () => {
    const onUnavailable = jest.fn();
    await render(
      <ExerciseImage
        image={squatImage}
        label={LABEL}
        variant="gallery"
        onUnavailable={onUnavailable}
      />,
      { wrapper: withContainer(exerciseContainer()) },
    );

    await screen.findByLabelText(LABEL);
    expect(onUnavailable).not.toHaveBeenCalled();
  });
});
