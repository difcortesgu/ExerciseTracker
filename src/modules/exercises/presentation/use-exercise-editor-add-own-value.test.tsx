import { act } from '@testing-library/react-native';

import { domainError } from '@shared/domain/domain-error';
import { err, ok } from '@shared/domain/result';
import { aVocabularyOption } from '@test/builders/exercise-dtos.builder';
import { storageFailed } from '@test/support/exercise-screen-harness';
import { recordingSubmit, renderEditor, sandbag } from '@test/support/exercise-editor-harness';

import { BLANK_FORM_VALUES } from './exercise-form-fields';

describe('useExerciseEditor — Add your own (S1-29)', () => {
  it('selects a new value and offers it in the picker, sending the selection it was given', async () => {
    const save = recordingSubmit();
    const { result } = await renderEditor(BLANK_FORM_VALUES, save.submit, {
      resolveVocabularyValue: (_kind, label) =>
        Promise.resolve(
          ok({
            option: aVocabularyOption().labelled(label.trim()).custom().build(),
            selection: { source: 'new', label: label.trim() },
          }),
        ),
    });

    let error: string | undefined;
    await act(async () => {
      error = await result.current.addOwnValue('equipment', ' Sandbag 2 ');
    });
    await act(async () => {
      await result.current.save();
    });

    expect(error).toBeUndefined();
    expect(result.current.fields.equipment?.option.label).toBe('Sandbag 2');
    expect(result.current.optionsFor('equipment').map(({ label }) => label)).toContain('Sandbag 2');
    expect(save.last()?.equipment).toEqual({ source: 'new', label: 'Sandbag 2' });
  });

  it('adding the same new value twice offers it once and chooses it once', async () => {
    const save = recordingSubmit();
    const { result } = await renderEditor(BLANK_FORM_VALUES, save.submit, {
      resolveVocabularyValue: (_kind, label) =>
        Promise.resolve(
          ok({
            option: aVocabularyOption().labelled('Core').custom().build(),
            selection: { source: 'new', label },
          }),
        ),
    });

    await act(async () => {
      await result.current.addOwnValue('primaryMuscles', 'Core');
    });
    await act(async () => {
      await result.current.addOwnValue('primaryMuscles', 'core');
    });
    await act(async () => {
      await result.current.save();
    });

    const labels = result.current.optionsFor('primaryMuscles').map(({ label }) => label);
    expect(labels.filter((label) => label === 'Core')).toHaveLength(1);
    expect(save.last()?.primaryMuscles).toEqual([{ source: 'new', label: 'Core' }]);
  });

  it('selects the existing value when the text matches one, without a duplicate entry', async () => {
    const { result } = await renderEditor(BLANK_FORM_VALUES, undefined, {
      resolveVocabularyValue: () =>
        Promise.resolve(
          ok({ option: sandbag, selection: { source: 'existing', key: sandbag.key } }),
        ),
    });

    await act(async () => {
      await result.current.addOwnValue('equipment', 'sandbag');
    });

    expect(result.current.fields.equipment?.option).toEqual(sandbag);
    expect(
      result.current.optionsFor('equipment').filter(({ key }) => key === sandbag.key),
    ).toHaveLength(1);
  });

  it('adds a new muscle to the chosen muscles of that field', async () => {
    const core = aVocabularyOption().labelled('Core').custom().build();
    const { result } = await renderEditor(BLANK_FORM_VALUES, undefined, {
      resolveVocabularyValue: () =>
        Promise.resolve(ok({ option: core, selection: { source: 'new', label: 'Core' } })),
    });

    await act(async () => {
      await result.current.addOwnValue('primaryMuscles', 'Core');
    });

    expect(result.current.fields.primaryMuscles.map(({ option: chosen }) => chosen.label)).toEqual([
      'Core',
    ]);
    expect(result.current.optionsFor('secondaryMuscles').map(({ label }) => label)).toContain(
      'Core',
    );
  });

  it('returns the reason a value was rejected', async () => {
    const { result } = await renderEditor(BLANK_FORM_VALUES, undefined, {
      resolveVocabularyValue: () =>
        Promise.resolve(
          err(domainError('exercises.vocabularyValueTooLong', 'long', { maximum: 40 })),
        ),
    });

    let error: string | undefined;
    await act(async () => {
      error = await result.current.addOwnValue('equipment', 'x'.repeat(41));
    });

    expect(error).toBe('Use at most 40 characters');
    expect(result.current.fields.equipment).toBeNull();
  });

  it('explains a storage failure while checking the value', async () => {
    const { result } = await renderEditor(BLANK_FORM_VALUES, undefined, {
      resolveVocabularyValue: () => Promise.resolve(err(storageFailed)),
    });

    let error: string | undefined;
    await act(async () => {
      error = await result.current.addOwnValue('category', 'Mobility');
    });

    expect(error).toBe('Your exercises could not be read or saved on this phone. Try again.');
  });
});
