import { renderHook } from '@testing-library/react-native';

import { exerciseContainer, withContainer } from '@test/support/exercise-screen-harness';

import { exerciseIdFromParam, useExerciseDetails, type RouteParam } from './use-exercise-details';

describe('exerciseIdFromParam', () => {
  it('turns a route param into an exercise id', () => {
    expect(exerciseIdFromParam('barbell-squat')).toEqual({ ok: true, value: 'barbell-squat' });
  });

  it.each<[string, RouteParam]>([
    ['missing', undefined],
    ['blank', '  '],
    ['repeated', ['a', 'b']],
  ])('treats a %s id as "not found"', (_case, param) => {
    const result = exerciseIdFromParam(param);

    expect(result.ok ? null : result.error.code).toBe('exercises.notFound');
  });
});

describe('useExerciseDetails', () => {
  it('shows "not found" for a malformed link without asking the use case', async () => {
    const getExerciseDetails = jest.fn(() => new Promise<never>(() => undefined));

    const { result } = await renderHook(() => useExerciseDetails(undefined), {
      wrapper: withContainer(exerciseContainer({ getExerciseDetails })),
    });

    expect(result.current.details).toEqual({
      status: 'failed',
      error: expect.objectContaining({ code: 'exercises.notFound' }),
    });
    expect(getExerciseDetails).not.toHaveBeenCalled();
  });

  it('refuses to delete without a valid id', async () => {
    const deleteCustomExercise = jest.fn(() => new Promise<never>(() => undefined));
    const { result } = await renderHook(() => useExerciseDetails(undefined), {
      wrapper: withContainer(exerciseContainer({ deleteCustomExercise })),
    });

    await expect(result.current.deleteExercise()).resolves.toBe(false);
    expect(deleteCustomExercise).not.toHaveBeenCalled();
  });
});
