import { router } from 'expo-router';
import { act, fireEvent, screen, within } from 'expo-router/testing-library';

import type { ExerciseId } from '@shared/domain/ids';
import { err, ok, type Result } from '@shared/domain/result';
import { pendingCalls, storageFailed } from '@test/support/exercise-screen-harness';
import { builtIn, custom, openDetail } from '@test/support/exercise-detail-harness';

import type { DeleteExerciseError } from '../application/save-exercise-errors';

describe('ExerciseDetailScreen — actions (S1-17, S1-21, S1-23)', () => {
  describe('actions', () => {
    it('offers only Duplicate as custom for a built-in, which opens the prefilled create form', async () => {
      await openDetail(builtIn);

      await screen.findByRole('header', { name: 'Barbell Squat' });
      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Duplicate as custom' }));

      expect(await screen.findByLabelText('Name')).toBeOnTheScreen();
      expect(screen).toHavePathname('/exercises/new');
      expect(screen).toHaveSearchParams({ duplicateOf: 'barbell-squat' });
    });

    it('offers Edit and Delete for a custom exercise; Edit opens the edit form', async () => {
      await openDetail(custom);

      await fireEvent.press(await screen.findByRole('button', { name: 'Edit' }));

      expect(await screen.findByLabelText('Name')).toBeOnTheScreen();
      expect(screen).toHavePathname('/exercises/my-goblet-squat/edit');
    });

    it('refreshes the details when coming back from the edit form', async () => {
      let calls = 0;
      await openDetail(custom, {
        getExerciseDetails: () => {
          calls += 1;
          return Promise.resolve(ok(calls === 1 ? custom : { ...custom, name: 'Goblet Squat' }));
        },
      });
      await fireEvent.press(await screen.findByRole('button', { name: 'Edit' }));
      await screen.findByLabelText('Name');

      await act(() => router.back());

      expect(await screen.findByRole('header', { name: 'Goblet Squat' })).toBeOnTheScreen();
    });
  });

  describe('delete (S1-21)', () => {
    it('asks for confirmation naming the exercise; Cancel changes nothing', async () => {
      const deleteCustomExercise = jest.fn(() =>
        Promise.resolve<Result<void, DeleteExerciseError>>(ok(undefined)),
      );
      await openDetail(custom, { deleteCustomExercise });

      await fireEvent.press(await screen.findByRole('button', { name: 'Delete' }));
      expect(screen.getByRole('header', { name: "Delete 'My Goblet Squat'?" })).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

      expect(deleteCustomExercise).not.toHaveBeenCalled();
      expect(
        screen.queryByRole('header', { name: "Delete 'My Goblet Squat'?" }),
      ).not.toBeOnTheScreen();
      expect(screen).toHavePathname('/exercises/my-goblet-squat');
    });

    it("closes the confirmation with Android's back, deleting nothing", async () => {
      const deleteCustomExercise = jest.fn(() =>
        Promise.resolve<Result<void, DeleteExerciseError>>(ok(undefined)),
      );
      await openDetail(custom, { deleteCustomExercise });

      await fireEvent.press(await screen.findByRole('button', { name: 'Delete' }));
      await fireEvent(screen.getByTestId('dialog'), 'requestClose');

      expect(deleteCustomExercise).not.toHaveBeenCalled();
      expect(screen.queryByTestId('dialog')).not.toBeOnTheScreen();
      expect(screen).toHavePathname('/exercises/my-goblet-squat');
    });

    it('deletes after confirmation and returns to the list', async () => {
      const deletes = pendingCalls<[ExerciseId], Result<void, DeleteExerciseError>>();
      await openDetail(custom, { deleteCustomExercise: deletes.fn });
      await fireEvent.press(await screen.findByRole('button', { name: 'Delete' }));

      const dialog = screen.getByTestId('dialog');
      await fireEvent.press(within(dialog).getByRole('button', { name: 'Delete' }));
      await act(async () => deletes.calls[0]?.resolve(ok(undefined)));

      expect(deletes.calls[0]?.args).toEqual(['my-goblet-squat']);
      expect(await screen.findByLabelText('Search exercises')).toBeOnTheScreen();
      expect(screen).toHavePathname('/exercises');
    });

    it('stays on the detail and says why when deleting fails', async () => {
      await openDetail(custom, {
        deleteCustomExercise: () => Promise.resolve(err(storageFailed)),
      });
      await fireEvent.press(await screen.findByRole('button', { name: 'Delete' }));

      await fireEvent.press(
        within(screen.getByTestId('dialog')).getByRole('button', { name: 'Delete' }),
      );

      expect(await screen.findByLabelText('Could not delete the exercise')).toHaveTextContent(
        /could not be read or saved/,
      );
      expect(screen).toHavePathname('/exercises/my-goblet-squat');
    });
  });
});
