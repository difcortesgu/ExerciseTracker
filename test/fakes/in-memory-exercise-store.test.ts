import { describeBuiltInImageCatalogContract } from '@test/contracts/exercises/built-in-image-catalog.contract';
import { describeBuiltInLibraryStoreContract } from '@test/contracts/exercises/built-in-library-store.contract';
import { describeExerciseReaderContract } from '@test/contracts/exercises/exercise-reader.contract';
import type { ExerciseStoreFixture } from '@test/contracts/exercises/exercise-store-fixture';
import { describeExerciseWriterContract } from '@test/contracts/exercises/exercise-writer.contract';
import { describeVocabularyReaderContract } from '@test/contracts/exercises/vocabulary-reader.contract';
import {
  aBuiltInExercise,
  aCustomExercise,
  aVocabularyValue,
} from '@test/builders/exercise.builder';

import { InMemoryExerciseStore } from './in-memory-exercise-store';

const fixture = (): ExerciseStoreFixture => {
  const store = new InMemoryExerciseStore();
  return {
    reader: store,
    writer: store,
    vocabularyReader: store,
    catalog: store,
    library: store,
    breakStorage: () => store.failWith(new Error('disk I/O error')),
  };
};

describeExerciseReaderContract('InMemoryExerciseStore', fixture);
describeExerciseWriterContract('InMemoryExerciseStore', fixture);
describeVocabularyReaderContract('InMemoryExerciseStore', fixture);
describeBuiltInImageCatalogContract('InMemoryExerciseStore', fixture);
describeBuiltInLibraryStoreContract('InMemoryExerciseStore', fixture);

describe('InMemoryExerciseStore test helpers', () => {
  it('starts with arranged exercises, values and seed version', async () => {
    const builtIn = aBuiltInExercise().build();
    const custom = aCustomExercise().build();
    const value = aVocabularyValue().build();

    const store = new InMemoryExerciseStore({
      exercises: [builtIn, custom],
      vocabulary: [value],
      seedVersion: 4,
    });

    expect(await store.readSeedVersion()).toEqual({ ok: true, value: 4 });
    expect(store.allExercises()).toEqual([builtIn, custom]);
    expect(await store.listValues()).toEqual({ ok: true, value: [value] });
  });

  it('counts writes, so tests can prove nothing was written', async () => {
    const store = new InMemoryExerciseStore();

    await store.saveCustom(aCustomExercise().build(), []);
    await store.applySeed({ seedVersion: 1, insert: [], update: [], archive: [], vocabulary: [] });

    expect(store.writeCount).toBe(2);
  });

  it('recovers when the arranged failure is cleared', async () => {
    const store = new InMemoryExerciseStore();
    store.failWith(new Error('busy'));

    store.recover();

    expect(await store.listActiveSummaries()).toEqual({ ok: true, value: [] });
  });
});
