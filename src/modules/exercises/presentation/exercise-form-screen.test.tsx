import { router } from 'expo-router';
import { act, fireEvent, screen } from 'expo-router/testing-library';

import { domainError } from '@shared/domain/domain-error';
import { err, ok } from '@shared/domain/result';
import { aPhotoView, aVocabularyOption } from '@test/builders/exercise-dtos.builder';
import { vocabularyKeyOf } from '@test/builders/exercise.builder';
import { storageFailed } from '@test/support/exercise-screen-harness';
import {
  fillValidForm,
  openForm,
  press,
  recordingCreate,
} from '@test/support/exercise-form-harness';

describe('Create exercise form (S1-19)', () => {
  it('has every field, findable by label, with no metric preselected', async () => {
    await openForm('/exercises/new');

    expect(await screen.findByLabelText('Name')).toHaveDisplayValue('');
    for (const field of ['Category', 'Primary muscles', 'Secondary muscles', 'Equipment']) {
      expect(screen.getByRole('button', { name: field })).toBeOnTheScreen();
    }
    expect(screen.getByLabelText('Instructions')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add photo' })).toBeEnabled();
    for (const metric of ['Weight', 'Reps', 'Time', 'Distance', 'RPE']) {
      expect(screen.getByRole('checkbox', { name: metric })).not.toBeChecked();
    }
  });

  it('saves the values and opens the detail of the new exercise', async () => {
    const create = recordingCreate();
    await openForm('/exercises/new', { createCustomExercise: create.createCustomExercise });
    await fillValidForm();

    await press('Save');

    expect(create.inputs).toEqual([
      expect.objectContaining({
        name: 'My Goblet Squat',
        category: { source: 'existing', key: vocabularyKeyOf('Strength') },
        primaryMuscles: [{ source: 'existing', key: vocabularyKeyOf('Quadriceps') }],
        trackedMetrics: ['weight', 'reps'],
      }),
    ]);
    expect(await screen.findByRole('button', { name: 'Duplicate as custom' })).toBeOnTheScreen();
    expect(screen).toHavePathname('/exercises/new-1');
  });

  it('shows each problem next to its field and stays on the form', async () => {
    const create = recordingCreate(
      err({
        code: 'exercises.invalidExercise',
        message: 'Invalid.',
        issues: [
          {
            field: 'name',
            code: 'exercises.duplicateName',
            message: 'taken',
            details: { existingName: 'Barbell Squat' },
          },
          { field: 'trackedMetrics', code: 'exercises.noTrackedMetric', message: 'none' },
        ],
      }),
    );
    await openForm('/exercises/new', { createCustomExercise: create.createCustomExercise });

    await press('Save');

    expect(await screen.findByText("'Barbell Squat' already exists")).toBeOnTheScreen();
    expect(screen.getByLabelText('Name').props.accessibilityHint).toBe(
      "'Barbell Squat' already exists",
    );
    expect(screen.getByText('Pick at least one')).toBeOnTheScreen();
    expect(screen).toHavePathname('/exercises/new');
  });

  it('shows a picker issue next to its picker', async () => {
    const create = recordingCreate(
      err({
        code: 'exercises.invalidExercise',
        message: 'Invalid.',
        issues: [{ field: 'category', code: 'exercises.categoryRequired', message: 'none' }],
      }),
    );
    await openForm('/exercises/new', { createCustomExercise: create.createCustomExercise });

    await press('Save');

    expect(await screen.findByText('Pick a category')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Category' }).props.accessibilityHint).toBe(
      'Pick a category',
    );
    expect(
      screen.getByRole('button', { name: 'Equipment' }).props.accessibilityHint,
    ).toBeUndefined();
  });

  it('shows a storage failure without losing the entered values', async () => {
    await openForm('/exercises/new', {
      createCustomExercise: recordingCreate(err(storageFailed)).createCustomExercise,
    });
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Squat');

    await press('Save');

    expect(await screen.findByLabelText('Could not save the exercise')).toBeOnTheScreen();
    expect(screen.getByLabelText('Name')).toHaveDisplayValue('Squat');
  });

  describe('pickers and "Add your own" (S1-29)', () => {
    it('lists built-in and your own values together', async () => {
      await openForm('/exercises/new');

      await press('Equipment');

      expect(await screen.findByRole('checkbox', { name: 'Barbell' })).toBeOnTheScreen();
      expect(screen.getByRole('checkbox', { name: 'Sandbag, Custom' })).toBeOnTheScreen();
    });

    it('selects a value added with Add your own and saves it with the exercise', async () => {
      const create = recordingCreate();
      await openForm('/exercises/new', {
        createCustomExercise: create.createCustomExercise,
        resolveVocabularyValue: (_kind, label) =>
          Promise.resolve(
            ok({
              option: aVocabularyOption().labelled(label).custom().build(),
              selection: { source: 'new', label },
            }),
          ),
      });
      await press('Equipment');

      await press('Add your own');
      await fireEvent.changeText(screen.getByLabelText('New equipment'), 'Weight vest');
      await press('Add');

      expect(await screen.findByRole('checkbox', { name: 'Weight vest, Custom' })).toBeChecked();
      await press('Done');
      expect(screen.getByRole('button', { name: 'Equipment' })).toHaveTextContent(/Weight vest/);
      await press('Save');
      expect(create.inputs[0]?.equipment).toEqual({ source: 'new', label: 'Weight vest' });
    });

    it('shows why a value was rejected in the Add your own input', async () => {
      await openForm('/exercises/new', {
        resolveVocabularyValue: () =>
          Promise.resolve(err(domainError('exercises.vocabularyValueRequired', 'blank'))),
      });
      await press('Category');
      await press('Add your own');

      await press('Add');

      expect(await screen.findByText('Enter a value')).toBeOnTheScreen();
      expect(screen.getByLabelText('New category')).toBeOnTheScreen();
    });
  });

  describe('leaving with unsaved changes', () => {
    it('leaves at once with Cancel when nothing changed', async () => {
      await openForm('/exercises/new');

      await press('Cancel');

      expect(await screen.findByLabelText('Search exercises')).toBeOnTheScreen();
    });

    it('asks "Discard changes?" on Cancel; Keep editing stays on the form', async () => {
      await openForm('/exercises/new');
      await fireEvent.changeText(await screen.findByLabelText('Name'), 'Squat');

      await press('Cancel');
      expect(await screen.findByRole('header', { name: 'Discard changes?' })).toBeOnTheScreen();
      await press('Keep editing');

      expect(screen.queryByRole('header', { name: 'Discard changes?' })).not.toBeOnTheScreen();
      expect(screen.getByLabelText('Name')).toHaveDisplayValue('Squat');
      expect(screen).toHavePathname('/exercises/new');
    });

    it("closes the question with Android's back and keeps editing", async () => {
      await openForm('/exercises/new');
      await fireEvent.changeText(await screen.findByLabelText('Name'), 'Squat');
      await press('Cancel');

      await fireEvent(await screen.findByTestId('dialog'), 'requestClose');

      expect(screen.queryByRole('header', { name: 'Discard changes?' })).not.toBeOnTheScreen();
      expect(screen.getByLabelText('Name')).toHaveDisplayValue('Squat');
      expect(screen).toHavePathname('/exercises/new');
    });

    it("asks on Android's back too; Discard leaves, stores nothing and deletes the photos copied here", async () => {
      const discardPhotos = jest.fn(() => Promise.resolve());
      const create = recordingCreate();
      await openForm('/exercises/new', {
        discardPhotos,
        createCustomExercise: create.createCustomExercise,
        importPhoto: () => Promise.resolve(ok(aPhotoView('new-1.jpg'))),
      });
      await press('Add photo');
      await press('Gallery');
      await screen.findByLabelText('Photo 1 of 1');

      await act(() => router.back());
      await press('Discard');

      expect(await screen.findByLabelText('Search exercises')).toBeOnTheScreen();
      expect(discardPhotos).toHaveBeenCalledWith([aPhotoView('new-1.jpg').fileName]);
      expect(create.inputs).toEqual([]);
    });
  });
});
