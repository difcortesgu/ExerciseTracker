import { act, fireEvent, screen, within } from 'expo-router/testing-library';
import { router } from 'expo-router';

import { err, ok } from '@shared/domain/result';
import { aCustomPhoto } from '@test/builders/exercise.builder';
import { anExerciseListItem } from '@test/builders/exercise-dtos.builder';
import {
  exerciseContainer,
  libraryItems,
  pendingCalls,
  rootStackScreens,
  renderExerciseApp,
  seedFailed,
  storageFailed,
} from '@test/support/exercise-screen-harness';
import { renderLibrary, searchingFind } from '@test/support/exercise-library-harness';

import type { ExerciseListItem, ExerciseSearchQuery } from '../application/exercise-dtos';
import type { ExerciseLibraryError } from '../application/library-errors';
import type { Result } from '@shared/domain/result';

import { MAX_MOUNTED_ROWS } from './exercises-screen';

type FindResult = Result<readonly ExerciseListItem[], ExerciseLibraryError>;

const rows = () => screen.queryAllByTestId('exercise-row');

describe('ExercisesScreen — exercise library (S1-16)', () => {
  it('shows the Exercises title and no "coming soon" placeholder', async () => {
    await renderLibrary();

    expect(screen.getByRole('header', { name: 'Exercises' })).toBeOnTheScreen();
    expect(await screen.findByText('Barbell Squat')).toBeOnTheScreen();
    expect(screen.queryByText(/coming soon/i)).not.toBeOnTheScreen();
  });

  it('lists each exercise with its name, category and primary muscles', async () => {
    await renderLibrary();

    const squat = await screen.findByRole('button', { name: /^Barbell Squat/ });

    expect(squat).toHaveTextContent(/Barbell Squat/);
    expect(squat).toHaveTextContent(/Strength · Quadriceps/);
  });

  it('marks custom exercises with a "Custom" badge, and only them', async () => {
    await renderLibrary();

    const custom = await screen.findByRole('button', { name: /^My Goblet Squat/ });

    expect(within(custom).getByText('Custom')).toBeOnTheScreen();
    expect(
      within(screen.getByRole('button', { name: /^Barbell Squat/ })).queryByText('Custom'),
    ).not.toBeOnTheScreen();
  });

  it('shows a thumbnail for exercises with an image and a neutral placeholder for the others', async () => {
    await renderLibrary();

    const squat = await screen.findByRole('button', { name: /^Barbell Squat/ });
    const custom = screen.getByRole('button', { name: /^My Goblet Squat/ });

    expect(
      await within(squat).findByLabelText('Barbell Squat', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(
      within(custom).getByLabelText('No image', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  describe('offline images link (S1-28)', () => {
    const OFFLINE_LINK = 'Download all images in Settings';
    const unavailable = () => Promise.resolve({ status: 'unavailable' as const });

    it('links unavailable built-in thumbnails to the offline images download in Settings', async () => {
      const view = await renderExerciseApp(exerciseContainer({ getExerciseImage: unavailable }));

      await fireEvent.press(await screen.findByRole('button', { name: OFFLINE_LINK }));

      expect(await screen.findByText('Settings tab')).toBeOnTheScreen();
      expect(rootStackScreens(view)).toEqual(['(tabs)']);
    });

    it('offers no link while every thumbnail is shown', async () => {
      await renderLibrary();

      await screen.findByText('2 exercises');
      await screen.findAllByLabelText('Barbell Squat', { includeHiddenElements: true });

      expect(screen.queryByRole('button', { name: OFFLINE_LINK })).not.toBeOnTheScreen();
    });

    it('offers no link when only a custom photo is missing (photos cannot be downloaded)', async () => {
      const customWithPhoto = anExerciseListItem()
        .named('My Goblet Squat')
        .with({ isCustom: true, coverImage: aCustomPhoto('missing.jpg') })
        .build();
      await renderExerciseApp(
        exerciseContainer({
          findExercises: () => Promise.resolve(ok([customWithPhoto])),
          getExerciseImage: unavailable,
        }),
      );

      expect(
        await screen.findByLabelText('Image not available offline', {
          includeHiddenElements: true,
        }),
      ).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: OFFLINE_LINK })).not.toBeOnTheScreen();
    });
  });

  it('shows the number of results', async () => {
    await renderLibrary();

    expect(await screen.findByText('2 exercises')).toBeOnTheScreen();
  });

  it('mounts far fewer rows than exercises, so ~900 exercises scroll smoothly', async () => {
    const many = Array.from({ length: 880 }, (_unused, index) =>
      anExerciseListItem().withId(`exercise-${index}`).named(`Exercise ${index}`).build(),
    );
    await renderLibrary(() => Promise.resolve(ok(many)));

    expect(await screen.findByText('880 exercises')).toBeOnTheScreen();
    expect(rows().length).toBeGreaterThan(0);
    expect(rows().length).toBeLessThan(MAX_MOUNTED_ROWS);
    expect(MAX_MOUNTED_ROWS).toBeLessThan(many.length / 10);
  });

  describe('states', () => {
    it('shows a loading state while the library is prepared (first launch seeding)', async () => {
      const pending = pendingCalls<[ExerciseSearchQuery], FindResult>();
      await renderLibrary(pending.fn);

      expect(screen.getByLabelText('Loading exercises')).toBeBusy();
      expect(rows()).toHaveLength(0);
    });

    it('shows an inline error with Retry when loading fails, and loads again on Retry', async () => {
      let calls = 0;
      await renderLibrary(() => {
        calls += 1;
        return Promise.resolve(calls === 1 ? err(storageFailed) : ok(libraryItems));
      });

      expect(await screen.findByLabelText('Could not load exercises')).toHaveTextContent(
        /could not be read or saved on this phone/,
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

      expect(await screen.findByText('Barbell Squat')).toBeOnTheScreen();
    });

    it('explains a failed library preparation (seeding, S1-13) with Retry', async () => {
      await renderLibrary(() => Promise.resolve(err(seedFailed)));

      expect(await screen.findByLabelText('Could not load exercises')).toHaveTextContent(
        /built-in exercises could not be saved/,
      );
      expect(screen.getByRole('button', { name: 'Retry' })).toBeOnTheScreen();
    });

    it('says nothing matches, without Clear filters when no filter is active', async () => {
      await renderLibrary(() => Promise.resolve(ok([])));

      expect(await screen.findByLabelText('Empty state')).toHaveTextContent('No exercises match');
      expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeOnTheScreen();
    });

    it('offers Clear filters in the empty state when filters are active', async () => {
      const find = searchingFind([]);
      await renderLibrary(find.findExercises);
      await fireEvent.press(await screen.findByRole('button', { name: 'Muscle' }));
      await fireEvent.press(await screen.findByRole('checkbox', { name: 'Glutes' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

      const emptyState = await screen.findByLabelText('Empty state');
      await fireEvent.press(within(emptyState).getByRole('button', { name: 'Clear filters' }));

      expect(find.queries.at(-1)?.muscles).toEqual([]);
    });
  });

  describe('navigation', () => {
    it('opens the detail of a tapped exercise', async () => {
      await renderLibrary();

      await fireEvent.press(await screen.findByRole('button', { name: /^Barbell Squat/ }));

      expect(await screen.findByRole('button', { name: 'Duplicate as custom' })).toBeOnTheScreen();
      expect(screen).toHavePathname('/exercises/barbell-squat');
    });

    it('opens the create form with Add exercise', async () => {
      await renderLibrary();

      await fireEvent.press(await screen.findByRole('button', { name: 'Add exercise' }));

      expect(await screen.findByLabelText('Name')).toBeOnTheScreen();
      expect(screen).toHavePathname('/exercises/new');
    });

    it('keeps the search and filters and refreshes the list when coming back', async () => {
      const find = searchingFind();
      await renderLibrary(find.findExercises);
      await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'squat');
      await fireEvent.press(screen.getByRole('button', { name: 'Muscle' }));
      await fireEvent.press(await screen.findByRole('checkbox', { name: 'Quadriceps' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
      await fireEvent.press(await screen.findByRole('button', { name: /^Barbell Squat/ }));
      await screen.findByRole('button', { name: 'Duplicate as custom' });
      const callsBeforeReturn = find.queries.length;

      await act(() => router.back());

      expect(await screen.findByLabelText('Search exercises')).toHaveDisplayValue('squat');
      expect(screen.getByRole('button', { name: 'Muscle (1)' })).toBeOnTheScreen();
      expect(find.queries.length).toBeGreaterThan(callsBeforeReturn);
      expect(find.queries.at(-1)?.muscles).toEqual(['quadriceps']);
    });
  });
});
