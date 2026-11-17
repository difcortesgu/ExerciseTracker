import { act } from '@testing-library/react-native';

import { err, ok } from '@shared/domain/result';
import { anExerciseFormValues } from '@test/builders/exercise-dtos.builder';
import { vocabularyKeyOf } from '@test/builders/exercise.builder';
import { storageFailed } from '@test/support/exercise-screen-harness';
import { option, recordingSubmit, renderEditor } from '@test/support/exercise-editor-harness';

import type { ExerciseFieldIssue } from '../domain/exercise-errors';
import type { SaveExerciseError } from '../application/save-exercise-errors';

import { BLANK_FORM_VALUES } from './exercise-form-fields';
import type { SaveSubmitter } from './use-exercise-editor';

const invalid = (...issues: ExerciseFieldIssue[]) =>
  err<SaveExerciseError>({ code: 'exercises.invalidExercise', message: 'Invalid.', issues });

describe('useExerciseEditor (S1-19, S1-20, S1-22, S1-29)', () => {
  it('starts blank for a new exercise, with no metric preselected and nothing to discard', async () => {
    const { result } = await renderEditor();

    expect(result.current.fields).toEqual(
      expect.objectContaining({ name: '', category: null, trackedMetrics: [], photos: [] }),
    );
    expect(result.current.isDirty).toBe(false);
  });

  it('submits the raw values as entered; existing options are sent by key', async () => {
    const save = recordingSubmit();
    const { result } = await renderEditor(BLANK_FORM_VALUES, save.submit);

    await act(async () => result.current.setName('  My Goblet Squat '));
    await act(async () => result.current.selectOne('category', option('Strength')));
    await act(async () => result.current.toggleMany('primaryMuscles', option('Quadriceps')));
    await act(async () => result.current.toggleMany('secondaryMuscles', option('Glutes')));
    await act(async () => result.current.selectOne('equipment', option('Kettlebells')));
    await act(async () => result.current.setInstructionsText('Hold it.\nSquat.'));
    await act(async () => result.current.toggleMetric('reps'));
    await act(async () => result.current.toggleMetric('weight'));
    await act(async () => {
      await result.current.save();
    });

    expect(save.last()).toEqual({
      name: '  My Goblet Squat ',
      category: { source: 'existing', key: vocabularyKeyOf('Strength') },
      primaryMuscles: [{ source: 'existing', key: vocabularyKeyOf('Quadriceps') }],
      secondaryMuscles: [{ source: 'existing', key: vocabularyKeyOf('Glutes') }],
      equipment: { source: 'existing', key: vocabularyKeyOf('Kettlebells') },
      instructionsText: 'Hold it.\nSquat.',
      photos: [],
      trackedMetrics: ['reps', 'weight'],
    });
  });

  it('prefills every current value when editing and is not dirty until something changes', async () => {
    const values = anExerciseFormValues().withPhotos('photo-1.jpg').build();
    const save = recordingSubmit();
    const { result } = await renderEditor(values, save.submit);
    expect(result.current.isDirty).toBe(false);

    await act(async () => {
      await result.current.save();
    });

    expect(save.last()).toEqual(
      expect.objectContaining({
        name: 'My Goblet Squat',
        category: { source: 'existing', key: vocabularyKeyOf('Strength') },
        equipment: { source: 'existing', key: vocabularyKeyOf('Kettlebells') },
        photos: ['photo-1.jpg'],
        trackedMetrics: ['weight', 'reps'],
      }),
    );
  });

  it('is dirty after a change and clean again when the change is undone', async () => {
    const { result } = await renderEditor();

    await act(async () => result.current.toggleMetric('rpe'));
    expect(result.current.isDirty).toBe(true);

    await act(async () => result.current.toggleMetric('rpe'));
    expect(result.current.isDirty).toBe(false);
  });

  it('replaces a single choice, and clears it when the chosen value is tapped again', async () => {
    const { result } = await renderEditor();

    await act(async () => result.current.selectOne('equipment', option('Barbell')));
    await act(async () => result.current.selectOne('equipment', option('Kettlebells')));
    expect(result.current.fields.equipment?.option.label).toBe('Kettlebells');

    await act(async () => result.current.selectOne('equipment', option('Kettlebells')));
    expect(result.current.fields.equipment).toBeNull();
  });

  describe('field issues', () => {
    it('shows each issue the domain returns next to its field and stores nothing', async () => {
      const save = recordingSubmit(
        invalid(
          { field: 'name', code: 'exercises.nameRequired', message: 'blank' },
          { field: 'trackedMetrics', code: 'exercises.noTrackedMetric', message: 'none' },
        ),
      );
      const { result } = await renderEditor(BLANK_FORM_VALUES, save.submit);

      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.save();
      });

      expect(outcome).toEqual({ saved: false });
      expect(result.current.errors).toEqual({
        name: 'Enter a name',
        trackedMetrics: 'Pick at least one',
      });
    });

    it('shows a rule the form knows nothing about, because the text comes from the domain code', async () => {
      const save = recordingSubmit(
        invalid({
          field: 'instructions',
          code: 'exercises.instructionsTooLong',
          message: 'too long',
          details: { maximum: 5000 },
        }),
      );
      const { result } = await renderEditor(BLANK_FORM_VALUES, save.submit);

      await act(async () => {
        await result.current.save();
      });

      expect(result.current.errors.instructions).toBe('Use at most 5000 characters in total');
    });

    it('shows a failure that is not about a field as a form error', async () => {
      const { result } = await renderEditor(
        BLANK_FORM_VALUES,
        recordingSubmit(err(storageFailed)).submit,
      );

      await act(async () => {
        await result.current.save();
      });

      expect(result.current.formError).toBe(
        'Your exercises could not be read or saved on this phone. Try again.',
      );
      expect(result.current.errors).toEqual({});
    });

    it('clears earlier issues on the next successful save', async () => {
      let attempt = 0;
      const submit: SaveSubmitter = () => {
        attempt += 1;
        return Promise.resolve(
          attempt === 1
            ? invalid({ field: 'name', code: 'exercises.nameRequired', message: 'blank' })
            : ok('new-id'),
        );
      };
      const { result } = await renderEditor(BLANK_FORM_VALUES, submit);
      await act(async () => {
        await result.current.save();
      });

      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.save();
      });

      expect(outcome).toEqual({ saved: true, value: 'new-id' });
      expect(result.current.errors).toEqual({});
    });
  });
});
