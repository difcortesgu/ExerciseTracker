import { exerciseStorageFailed } from './storage-failure';

describe('exerciseStorageFailed', () => {
  it('describes the cause of a storage failure, including wrapped causes', () => {
    const cause = new Error('Failed query', { cause: new Error('disk I/O error') });

    expect(exerciseStorageFailed(cause)).toEqual({
      code: 'exercises.storageFailed',
      message: 'The exercise library could not be read or written.',
      details: { cause: 'Failed query: disk I/O error' },
    });
  });
});
