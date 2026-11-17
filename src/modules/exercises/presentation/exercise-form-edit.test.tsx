import { fireEvent, screen } from 'expo-router/testing-library';

import { domainError } from '@shared/domain/domain-error';
import type { ExerciseId } from '@shared/domain/ids';
import { err, ok } from '@shared/domain/result';
import { anExerciseFormValues } from '@test/builders/exercise-dtos.builder';
import { storageFailed } from '@test/support/exercise-screen-harness';
import { openForm, press, recordingCreate } from '@test/support/exercise-form-harness';

import type { ExerciseInput } from '../application/exercise-dtos';

describe('Edit exercise form (S1-20)', () => {
  it('opens prefilled with every current value and photo', async () => {
    await openForm('/exercises/my-goblet-squat/edit', {
      getExerciseFormValues: () =>
        Promise.resolve(ok(anExerciseFormValues().withPhotos('p1.jpg').build())),
    });

    expect(await screen.findByLabelText('Name')).toHaveDisplayValue('My Goblet Squat');
    expect(screen.getByRole('button', { name: 'Category' })).toHaveTextContent(/Strength/);
    expect(screen.getByRole('button', { name: 'Equipment' })).toHaveTextContent(/Kettlebells/);
    expect(screen.getByLabelText('Instructions')).toHaveDisplayValue(
      'Hold the kettlebell at your chest.\nSquat down and stand up.',
    );
    expect(screen.getByLabelText('Photo 1 of 1')).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'Weight' })).toBeChecked();
  });

  it('saves the changes for the same id and returns', async () => {
    const updates: [ExerciseId, ExerciseInput][] = [];
    await openForm('/exercises/my-goblet-squat/edit', {
      updateCustomExercise: (id, input) => {
        updates.push([id, input]);
        return Promise.resolve(ok(undefined));
      },
    });
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Goblet Squat');

    await press('Save');

    expect(updates[0]?.[0]).toBe('my-goblet-squat');
    expect(updates[0]?.[1].name).toBe('Goblet Squat');
    expect(await screen.findByLabelText('Search exercises')).toBeOnTheScreen();
  });

  it('shows "Exercise not found" for an unknown or deleted exercise', async () => {
    await openForm('/exercises/gone/edit', {
      getExerciseFormValues: () => Promise.resolve(err(domainError('exercises.notFound', 'gone'))),
    });

    expect(await screen.findByLabelText('Exercise not found')).toBeOnTheScreen();
  });

  it('shows "Exercise not found" for a malformed link without asking the use case', async () => {
    const getExerciseFormValues = jest.fn(() =>
      Promise.resolve(ok(anExerciseFormValues().build())),
    );
    await openForm('/exercises/%20/edit', { getExerciseFormValues });

    expect(await screen.findByLabelText('Exercise not found')).toBeOnTheScreen();
    expect(getExerciseFormValues).not.toHaveBeenCalled();
  });

  it('refuses to edit a built-in reached by a stale link', async () => {
    await openForm('/exercises/barbell-squat/edit', {
      getExerciseFormValues: () =>
        Promise.resolve(err(domainError('exercises.builtInReadOnly', 'read-only'))),
    });

    expect(await screen.findByLabelText('Could not open the form')).toHaveTextContent(
      /Built-in exercises cannot be changed/,
    );
  });

  it('shows a loading state, then an error with Retry when the form cannot be opened', async () => {
    let calls = 0;
    await openForm('/exercises/my-goblet-squat/edit', {
      getExerciseFormValues: () => {
        calls += 1;
        return calls === 1 ? Promise.resolve(err(storageFailed)) : new Promise(() => undefined);
      },
    });

    await press('Retry');

    expect(await screen.findByLabelText('Loading form')).toBeBusy();
  });
});

describe('Duplicate as custom (S1-23)', () => {
  it('opens the create form prefilled from the built-in and saves a new exercise', async () => {
    const create = recordingCreate();
    const sources: ExerciseId[] = [];
    await openForm('/exercises/new?duplicateOf=barbell-squat', {
      createCustomExercise: create.createCustomExercise,
      prepareDuplicate: (id) => {
        sources.push(id);
        return Promise.resolve(
          ok(anExerciseFormValues().with({ name: 'Barbell Squat (custom)' }).build()),
        );
      },
    });

    expect(await screen.findByLabelText('Name')).toHaveDisplayValue('Barbell Squat (custom)');
    expect(sources).toEqual(['barbell-squat']);
    await press('Save');
    expect(create.inputs[0]?.name).toBe('Barbell Squat (custom)');
  });
});
