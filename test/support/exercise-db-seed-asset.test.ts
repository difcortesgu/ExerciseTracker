import { aBuiltInExercise, aVocabularyValue } from '@test/builders/exercise.builder';

import { aSeedAssetJson, aSeedManifestJson, seedExerciseJson } from './exercise-db-seed-asset';

describe('seed asset JSON builders', () => {
  it('groups the vocabulary by kind as {key, label} entries, keeping the order', () => {
    const asset = aSeedAssetJson(
      {
        exercises: [],
        vocabulary: [
          aVocabularyValue().labelled('Barbell').build(),
          aVocabularyValue().ofKind('category').labelled('Strength').build(),
        ],
      },
      2,
    );

    expect(asset).toEqual({
      formatVersion: 1,
      seedVersion: 2,
      vocabulary: {
        category: [{ key: 'strength', label: 'Strength' }],
        muscle: [],
        equipment: [{ key: 'barbell', label: 'Barbell' }],
      },
      exercises: [],
    });
  });

  it('writes an exercise with the dataset key and plain image entries', () => {
    const data = aBuiltInExercise().named('Plank').buildData();

    expect(seedExerciseJson(data)).toMatchObject({
      key: 'Plank',
      images: [
        { path: 'Plank/0.jpg', sizeBytes: expect.any(Number) as unknown },
        { path: 'Plank/1.jpg', sizeBytes: expect.any(Number) as unknown },
      ],
    });
  });

  it('builds a manifest with overridable fields', () => {
    expect(aSeedManifestJson({ seedVersion: 9 })).toMatchObject({
      formatVersion: 1,
      seedVersion: 9,
    });
  });
});
