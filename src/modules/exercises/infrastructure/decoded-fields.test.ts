import { err, ok } from '@shared/domain/result';

import { decodeFields } from './decoded-fields';

describe('decodeFields', () => {
  it('returns the fields narrowed to successes, typed by field', () => {
    const decoded = decodeFields({ name: ok('Squat'), sizeBytes: ok(12) });

    expect(decoded.ok).toBe(true);
    const name: string = decoded.ok ? decoded.value.name.value : '';
    const sizeBytes: number = decoded.ok ? decoded.value.sizeBytes.value : 0;
    expect({ name, sizeBytes }).toEqual({ name: 'Squat', sizeBytes: 12 });
  });

  it('returns every failure, each prefixed with its field name', () => {
    expect(
      decodeFields({ name: ok('Squat'), level: err('unknown level'), force: err('unknown force') }),
    ).toEqual({ ok: false, error: 'level: unknown level; force: unknown force' });
  });

  it('accepts no fields', () => {
    expect(decodeFields({})).toEqual({ ok: true, value: {} });
  });
});
