import { domainError } from '@shared/domain/domain-error';

import {
  EnsureLibrarySeededStub,
  failedSeeding,
  seededLibrary,
} from './stub-ensure-library-seeded';

describe('EnsureLibrarySeeded stubs', () => {
  it('reports an up-to-date library', async () => {
    expect(await seededLibrary()()).toEqual({
      ok: true,
      value: { kind: 'upToDate', seedVersion: 1 },
    });
  });

  it('fails with the given seeding error', async () => {
    const error = domainError('exercises.seedFailed', 'Seeding failed.');

    expect(await failedSeeding(error)()).toEqual({ ok: false, error });
  });

  it('counts calls', async () => {
    const stub = new EnsureLibrarySeededStub();

    await stub.ensure();
    await stub.ensure();

    expect(stub.calls).toBe(2);
  });
});
