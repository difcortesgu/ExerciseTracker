import { err, ok } from '@shared/domain/result';

import { decodeRows, inBatches, runStorage } from './sqlite-storage';

describe('runStorage', () => {
  it('resolves with the value of a successful operation', async () => {
    expect(await runStorage(() => ok([1, 2]))).toEqual({ ok: true, value: [1, 2] });
  });

  it('turns corrupt stored data into exercises.storageFailed with the reason', async () => {
    expect(await runStorage(() => err('exercise "b-1": level: unknown level'))).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: 'exercises.storageFailed',
        details: { cause: 'exercise "b-1": level: unknown level' },
      }) as unknown,
    });
  });

  it('resolves (never rejects) with exercises.storageFailed when the driver throws', async () => {
    const outcome = await runStorage(() => {
      throw new TypeError('The database connection is not open');
    });

    expect(outcome).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: 'exercises.storageFailed',
        details: { cause: 'The database connection is not open' },
      }) as unknown,
    });
  });
});

describe('decodeRows', () => {
  const decodeEven = (row: number) => (row % 2 === 0 ? ok(row / 2) : err(`odd ${row}`));

  it('decodes every row in order', () => {
    expect(decodeRows([2, 4, 8], decodeEven)).toEqual({ ok: true, value: [1, 2, 4] });
  });

  it('fails with the first corrupt row', () => {
    expect(decodeRows([2, 3, 5], decodeEven)).toEqual({ ok: false, error: 'odd 3' });
  });
});

describe('inBatches', () => {
  it('splits a list into consecutive batches of at most the given size', () => {
    expect(inBatches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns no batch for an empty list', () => {
    expect(inBatches([], 2)).toEqual([]);
  });
});
