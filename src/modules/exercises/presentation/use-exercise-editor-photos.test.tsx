import { act } from '@testing-library/react-native';

import { domainError } from '@shared/domain/domain-error';
import { err, ok } from '@shared/domain/result';
import { aPhotoView, anExerciseFormValues } from '@test/builders/exercise-dtos.builder';
import { recordingSubmit, renderEditor } from '@test/support/exercise-editor-harness';

import type { PhotoView } from '../application/exercise-dtos';

import { BLANK_FORM_VALUES } from './exercise-form-fields';

describe('useExerciseEditor — photos (S1-22)', () => {
  const photo = (fileName: string): PhotoView => aPhotoView(fileName);

  it('adds the imported photo and sends its file name on save', async () => {
    const save = recordingSubmit();
    const importPhoto = jest.fn(() => Promise.resolve(ok(photo('new-1.jpg'))));
    const { result } = await renderEditor(BLANK_FORM_VALUES, save.submit, { importPhoto });

    await act(async () => result.current.addPhoto('camera'));
    await act(async () => {
      await result.current.save();
    });

    expect(importPhoto).toHaveBeenCalledWith('camera');
    expect(result.current.fields.photos).toEqual([photo('new-1.jpg')]);
    expect(save.last()?.photos).toEqual(['new-1.jpg']);
  });

  it('counts an imported copy as a change even after removing it, so leaving offers to discard it', async () => {
    const { result } = await renderEditor(BLANK_FORM_VALUES, undefined, {
      importPhoto: () => Promise.resolve(ok(photo('new-1.jpg'))),
    });
    await act(async () => result.current.addPhoto('library'));

    await act(async () => result.current.removePhoto(photo('new-1.jpg').fileName));

    expect(result.current.isDirty).toBe(true);
  });

  it('changes nothing when the picker is cancelled', async () => {
    const { result } = await renderEditor(BLANK_FORM_VALUES, undefined, {
      importPhoto: () => Promise.resolve(ok(null)),
    });

    await act(async () => result.current.addPhoto('library'));

    expect(result.current.fields.photos).toEqual([]);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.photoError).toBeUndefined();
  });

  it('explains a denied permission and keeps the rest of the form', async () => {
    const { result } = await renderEditor(BLANK_FORM_VALUES, undefined, {
      importPhoto: () =>
        Promise.resolve(
          err(domainError('exercises.photoPermissionDenied', 'denied', { source: 'camera' })),
        ),
    });
    await act(async () => result.current.setName('Squat'));

    await act(async () => result.current.addPhoto('camera'));

    expect(result.current.photoError).toMatch(/^Camera access is off/);
    expect(result.current.fields.name).toBe('Squat');
  });

  it('allows adding photos only up to the domain maximum', async () => {
    const six = anExerciseFormValues()
      .withPhotos('p1.jpg', 'p2.jpg', 'p3.jpg', 'p4.jpg', 'p5.jpg', 'p6.jpg')
      .build();
    const { result } = await renderEditor(six);

    expect(result.current.canAddPhoto).toBe(false);
  });

  it('removes a photo from the form; on save the use case deletes its file', async () => {
    const save = recordingSubmit();
    const values = anExerciseFormValues().withPhotos('old-1.jpg', 'old-2.jpg').build();
    const { result } = await renderEditor(values, save.submit);

    await act(async () => result.current.removePhoto(photo('old-1.jpg').fileName));
    await act(async () => {
      await result.current.save();
    });

    expect(save.last()?.photos).toEqual(['old-2.jpg']);
  });

  it('on discard deletes nothing when no photo was imported in this form', async () => {
    const discardPhotos = jest.fn(() => Promise.resolve());
    const values = anExerciseFormValues().withPhotos('old-1.jpg').build();
    const { result } = await renderEditor(values, undefined, { discardPhotos });
    await act(async () => result.current.setName('Renamed'));

    await act(async () => result.current.discard());

    expect(discardPhotos).not.toHaveBeenCalled();
  });

  it('on discard deletes only the copies imported in this form, never the saved photos', async () => {
    const discardPhotos = jest.fn(() => Promise.resolve());
    const values = anExerciseFormValues().withPhotos('old-1.jpg').build();
    let imported = 0;
    const { result } = await renderEditor(values, undefined, {
      discardPhotos,
      importPhoto: () => {
        imported += 1;
        return Promise.resolve(ok(photo(`new-${imported}.jpg`)));
      },
    });
    await act(async () => result.current.addPhoto('library'));
    await act(async () => result.current.addPhoto('library'));
    await act(async () => result.current.removePhoto(photo('new-2.jpg').fileName));
    await act(async () => result.current.removePhoto(photo('old-1.jpg').fileName));

    await act(async () => result.current.discard());

    expect(discardPhotos).toHaveBeenCalledWith([
      photo('new-1.jpg').fileName,
      photo('new-2.jpg').fileName,
    ]);
  });

  it('after saving, deletes the copies imported here but removed before saving', async () => {
    const discardPhotos = jest.fn(() => Promise.resolve());
    let imported = 0;
    const { result } = await renderEditor(BLANK_FORM_VALUES, recordingSubmit().submit, {
      discardPhotos,
      importPhoto: () => {
        imported += 1;
        return Promise.resolve(ok(photo(`new-${imported}.jpg`)));
      },
    });
    await act(async () => result.current.addPhoto('library'));
    await act(async () => result.current.addPhoto('library'));
    await act(async () => result.current.removePhoto(photo('new-1.jpg').fileName));

    await act(async () => {
      await result.current.save();
    });

    expect(discardPhotos).toHaveBeenCalledWith([photo('new-1.jpg').fileName]);
  });

  it('deletes nothing after saving when every imported copy is kept', async () => {
    const discardPhotos = jest.fn(() => Promise.resolve());
    const { result } = await renderEditor(BLANK_FORM_VALUES, recordingSubmit().submit, {
      discardPhotos,
      importPhoto: () => Promise.resolve(ok(photo('new-1.jpg'))),
    });
    await act(async () => result.current.addPhoto('library'));

    await act(async () => {
      await result.current.save();
    });

    expect(discardPhotos).not.toHaveBeenCalled();
  });
});
