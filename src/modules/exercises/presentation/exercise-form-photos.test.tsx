import { fireEvent, screen, within } from 'expo-router/testing-library';

import { domainError } from '@shared/domain/domain-error';
import { err, ok } from '@shared/domain/result';
import { aPhotoView, anExerciseFormValues } from '@test/builders/exercise-dtos.builder';
import { openForm, press } from '@test/support/exercise-form-harness';

describe('Create exercise form — photos (S1-22)', () => {
  it('offers Camera or Gallery, and shows the imported photo', async () => {
    const importPhoto = jest.fn(() => Promise.resolve(ok(aPhotoView('new-1.jpg'))));
    await openForm('/exercises/new', { importPhoto });

    await press('Add photo');
    expect(screen.getByRole('button', { name: 'Camera' })).toBeOnTheScreen();
    await press('Camera');

    expect(await screen.findByLabelText('Photo 1 of 1')).toBeOnTheScreen();
    expect(importPhoto).toHaveBeenCalledWith('camera');
  });

  it('closes the chooser without importing on Cancel', async () => {
    const importPhoto = jest.fn(() => Promise.resolve(ok(null)));
    await openForm('/exercises/new', { importPhoto });
    await press('Add photo');

    await fireEvent.press(
      within(screen.getByTestId('dialog')).getByRole('button', { name: 'Cancel' }),
    );

    expect(importPhoto).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Camera' })).not.toBeOnTheScreen();
  });

  it("closes the chooser with Android's back without importing", async () => {
    const importPhoto = jest.fn(() => Promise.resolve(ok(null)));
    await openForm('/exercises/new', { importPhoto });
    await press('Add photo');

    await fireEvent(screen.getByTestId('dialog'), 'requestClose');

    expect(importPhoto).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Camera' })).not.toBeOnTheScreen();
  });

  it('explains how to allow a denied source', async () => {
    await openForm('/exercises/new', {
      importPhoto: () =>
        Promise.resolve(
          err(domainError('exercises.photoPermissionDenied', 'denied', { source: 'camera' })),
        ),
    });
    await press('Add photo');

    await press('Camera');

    expect(await screen.findByText(/^Camera access is off/)).toBeOnTheScreen();
  });

  it('removes a photo from the form', async () => {
    await openForm('/exercises/new', {
      importPhoto: () => Promise.resolve(ok(aPhotoView('new-1.jpg'))),
    });
    await press('Add photo');
    await press('Gallery');

    await press('Remove photo 1');

    expect(screen.queryByLabelText('Photo 1 of 1')).not.toBeOnTheScreen();
  });

  it('disables Add photo with a hint once the maximum is reached', async () => {
    await openForm('/exercises/my-goblet-squat/edit', {
      getExerciseFormValues: () =>
        Promise.resolve(
          ok(
            anExerciseFormValues()
              .withPhotos('p1.jpg', 'p2.jpg', 'p3.jpg', 'p4.jpg', 'p5.jpg', 'p6.jpg')
              .build(),
          ),
        ),
    });

    expect(await screen.findByRole('button', { name: 'Add photo' })).toBeDisabled();
    expect(screen.getByText('Up to 6 photos')).toBeOnTheScreen();
  });
});
