import { describeExerciseSeedSourceContract } from '@test/contracts/exercises/exercise-seed-source.contract';
import { aBuiltInExercise } from '@test/builders/exercise.builder';

import { FakeExerciseSeedSource, FAKE_SEED_MANIFEST } from './fake-exercise-seed-source';

describeExerciseSeedSourceContract('FakeExerciseSeedSource', () => {
  const source = new FakeExerciseSeedSource();
  return {
    source,
    givenDataset: (content) => source.givenDataset(content),
    givenInvalidDataset: () => source.failWith('Unknown category "yoga".'),
    givenUnreadableDataset: () => source.failWith('Cannot find module'),
  };
});

describe('FakeExerciseSeedSource', () => {
  it('has an empty dataset at the manifest seed version by default', async () => {
    expect(await new FakeExerciseSeedSource().loadDataset()).toEqual({
      ok: true,
      value: { seedVersion: FAKE_SEED_MANIFEST.seedVersion, exercises: [], vocabulary: [] },
    });
  });

  it('takes another seed version and counts loads', async () => {
    const source = new FakeExerciseSeedSource({ seedVersion: 7 });
    source.givenDataset({ exercises: [aBuiltInExercise().buildData()], vocabulary: [] });

    const loaded = await source.loadDataset();

    expect(source.manifest.seedVersion).toBe(7);
    expect(loaded).toMatchObject({ ok: true, value: { seedVersion: 7 } });
    expect(source.loadCount).toBe(1);
  });
});
