import { router } from 'expo-router';
import { act, fireEvent, screen } from 'expo-router/testing-library';

import { err, ok } from '@shared/domain/result';
import { anExerciseDetails } from '@test/builders/exercise-dtos.builder';
import {
  exerciseContainer,
  rootStackScreens,
  renderExerciseApp,
  storageFailed,
} from '@test/support/exercise-screen-harness';
import { builtIn, custom, notFound, openDetail } from '@test/support/exercise-detail-harness';

const swipeGalleryTo = (page: number) =>
  fireEvent(screen.getByTestId('image-gallery'), 'momentumScrollEnd', {
    nativeEvent: {
      contentOffset: { x: page * 360, y: 0 },
      layoutMeasurement: { width: 360, height: 270 },
      contentSize: { width: 720, height: 270 },
    },
  });

describe('ExerciseDetailScreen (S1-17)', () => {
  it('shows the name, category, equipment, muscles, tracked metrics and built-in attributes', async () => {
    await openDetail(builtIn);

    expect(await screen.findByRole('header', { name: 'Barbell Squat' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Category: Strength')).toBeOnTheScreen();
    expect(screen.getByLabelText('Equipment: Barbell')).toBeOnTheScreen();
    expect(screen.getByLabelText('Primary muscles: Quadriceps')).toBeOnTheScreen();
    expect(screen.getByLabelText('Secondary muscles: Glutes, Hamstrings')).toBeOnTheScreen();
    expect(screen.getByLabelText('Tracked metrics: Weight, Reps')).toBeOnTheScreen();
    expect(screen.getByLabelText('Level: Beginner')).toBeOnTheScreen();
    expect(screen.getByLabelText('Force: Push')).toBeOnTheScreen();
    expect(screen.getByLabelText('Mechanic: Compound')).toBeOnTheScreen();
  });

  it('shows the instructions as numbered steps', async () => {
    await openDetail(builtIn);

    expect(await screen.findByRole('header', { name: 'Instructions' })).toBeOnTheScreen();
    expect(screen.getByText(/^1\. Set the bar on your upper back/)).toBeOnTheScreen();
    expect(screen.getByText(/^2\. Squat down until your thighs/)).toBeOnTheScreen();
  });

  it('leaves out what a custom exercise does not have', async () => {
    await openDetail(
      anExerciseDetails()
        .custom()
        .with({ equipment: null, secondaryMuscles: [], instructions: [] })
        .build(),
    );

    expect(await screen.findByLabelText('Equipment: Not specified')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Secondary muscles/)).not.toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Level/)).not.toBeOnTheScreen();
    expect(screen.getByText('No instructions')).toBeOnTheScreen();
  });

  it('shows force and mechanic only when the dataset has them', async () => {
    await openDetail(
      anExerciseDetails()
        .with({ builtIn: { level: 'expert', force: null, mechanic: null } })
        .build(),
    );

    expect(await screen.findByLabelText('Level: Expert')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Force/)).not.toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Mechanic/)).not.toBeOnTheScreen();
  });

  describe('gallery', () => {
    it('shows every image with its position, labelled for screen readers', async () => {
      await openDetail(builtIn);

      expect(await screen.findByLabelText('Barbell Squat, image 1 of 2')).toBeOnTheScreen();
      expect(await screen.findByLabelText('Barbell Squat, image 2 of 2')).toBeOnTheScreen();
      expect(screen.getByText('1 / 2')).toBeOnTheScreen();
    });

    it('updates the position indicator when swiped', async () => {
      await openDetail(builtIn);
      await screen.findByText('1 / 2');

      await swipeGalleryTo(1);

      expect(screen.getByText('2 / 2')).toBeOnTheScreen();
    });

    it('shows a neutral placeholder and no indicator when there are no images', async () => {
      await openDetail(anExerciseDetails().with({ images: [] }).build());

      expect(await screen.findByLabelText('No image')).toBeOnTheScreen();
      expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeOnTheScreen();
      expect(screen.queryByTestId('image-gallery')).not.toBeOnTheScreen();
    });

    it('links an offline placeholder of a built-in to the offline images download in Settings', async () => {
      const view = await openDetail(builtIn, {
        getExerciseImage: () => Promise.resolve({ status: 'unavailable' }),
      });

      const [placeholder] = await screen.findAllByLabelText('Image not available offline');
      expect(placeholder).toBeOnTheScreen();
      await fireEvent.press(
        screen.getByRole('button', { name: 'Download all images in Settings' }),
      );

      expect(await screen.findByText('Settings tab')).toBeOnTheScreen();
      expect(screen).toHavePathname('/settings');
      // The detail is closed and the existing tabs switch to Settings (no second tab bar on top).
      expect(rootStackScreens(view)).toEqual(['(tabs)']);
    });

    it('offers no download link for a custom exercise whose photo is missing', async () => {
      await openDetail(custom, {
        getExerciseImage: () => Promise.resolve({ status: 'unavailable' }),
      });

      expect(await screen.findByLabelText('Image not available offline')).toBeOnTheScreen();
      expect(
        screen.queryByRole('button', { name: 'Download all images in Settings' }),
      ).not.toBeOnTheScreen();
    });
  });

  describe('states', () => {
    it('shows a loading state while the exercise loads', async () => {
      await openDetail(builtIn, { getExerciseDetails: () => new Promise(() => undefined) });

      expect(await screen.findByLabelText('Loading exercise')).toBeBusy();
    });

    it('shows "Exercise not found" with a way back for an unknown or deleted exercise', async () => {
      await openDetail(null);

      expect(await screen.findByLabelText('Exercise not found')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Back to exercises' }));

      expect(await screen.findByLabelText('Search exercises')).toBeOnTheScreen();
    });

    it('goes to the library from "Exercise not found" when opened directly (no history)', async () => {
      await renderExerciseApp(
        exerciseContainer({ getExerciseDetails: () => Promise.resolve(err(notFound)) }),
        '/exercises/gone',
      );

      await fireEvent.press(await screen.findByRole('button', { name: 'Back to exercises' }));

      expect(await screen.findByLabelText('Search exercises')).toBeOnTheScreen();
    });

    it('shows an error with Retry when loading fails, and loads again on Retry', async () => {
      let calls = 0;
      await openDetail(builtIn, {
        getExerciseDetails: () => {
          calls += 1;
          return Promise.resolve(calls === 1 ? err(storageFailed) : ok(builtIn));
        },
      });

      expect(await screen.findByLabelText('Could not load the exercise')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

      expect(await screen.findByRole('header', { name: 'Barbell Squat' })).toBeOnTheScreen();
    });

    it('returns to the list with its search kept on back (S1-16)', async () => {
      await renderExerciseApp(exerciseContainer());
      await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'squat');
      await fireEvent.press(await screen.findByRole('button', { name: /^Barbell Squat/ }));
      await screen.findByRole('button', { name: 'Duplicate as custom' });

      await act(() => router.back());

      expect(await screen.findByLabelText('Search exercises')).toHaveDisplayValue('squat');
    });
  });
});
