import { act, fireEvent, screen } from 'expo-router/testing-library';

import { renderLibrary, searchingFind } from '@test/support/exercise-library-harness';

import { SEARCH_DEBOUNCE_MS } from './use-exercise-library';

describe('ExercisesScreen — search and filters (S1-16, S1-29)', () => {
  describe('search', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('updates the list from the use case while typing', async () => {
      const find = searchingFind();
      await renderLibrary(find.findExercises);
      await screen.findByText('2 exercises');

      await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'goblet');
      await act(async () => jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS));

      expect(find.queries.at(-1)?.text).toBe('goblet');
      expect(await screen.findByText('1 exercise')).toBeOnTheScreen();
      expect(screen.queryByText('Barbell Squat')).not.toBeOnTheScreen();
    });
  });

  describe('filters', () => {
    it('filters by a picked muscle and shows the active filter', async () => {
      const find = searchingFind();
      await renderLibrary(find.findExercises);
      await screen.findByText('2 exercises');

      await fireEvent.press(screen.getByRole('button', { name: 'Muscle' }));
      await fireEvent.press(await screen.findByRole('checkbox', { name: 'Quadriceps' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

      expect(find.queries.at(-1)?.muscles).toEqual(['quadriceps']);
      expect(await screen.findByText('1 exercise')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Muscle (1)' })).toBeOnTheScreen();
      expect(screen.getByRole('checkbox', { name: 'Quadriceps' })).toBeChecked();
    });

    it('marks your own values in the picker', async () => {
      await renderLibrary();

      await fireEvent.press(await screen.findByRole('button', { name: 'Equipment' }));

      expect(await screen.findByRole('checkbox', { name: 'Sandbag, Custom' })).toBeOnTheScreen();
    });

    it('removes an active filter when its chip is tapped', async () => {
      const find = searchingFind();
      await renderLibrary(find.findExercises);
      await fireEvent.press(await screen.findByRole('button', { name: 'Muscle' }));
      await fireEvent.press(await screen.findByRole('checkbox', { name: 'Quadriceps' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

      await fireEvent.press(screen.getByRole('checkbox', { name: 'Quadriceps' }));

      expect(find.queries.at(-1)?.muscles).toEqual([]);
      expect(await screen.findByText('2 exercises')).toBeOnTheScreen();
    });

    it('clears every filter with Clear filters', async () => {
      const find = searchingFind();
      await renderLibrary(find.findExercises);
      expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeOnTheScreen();
      await fireEvent.press(await screen.findByRole('button', { name: 'Category' }));
      await fireEvent.press(await screen.findByRole('checkbox', { name: 'Strength' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

      await fireEvent.press(screen.getByRole('button', { name: 'Clear filters' }));

      expect(find.queries.at(-1)?.categories).toEqual([]);
      expect(screen.getByRole('button', { name: 'Category' })).toBeOnTheScreen();
    });
  });
});
