import type {
  ExerciseSeedSource,
  SeedDataset,
} from '@modules/exercises/application/library-seed-ports';

import { aBuiltInExercise, aVocabularyValue } from '../../builders/exercise.builder';
import { defineContract } from '../contract-harness';

/** A seed source plus a way to arrange what the bundled asset contains. */
export interface ExerciseSeedSourceFixture {
  readonly source: ExerciseSeedSource;
  /** The asset holds this content (its seed version is the manifest's). */
  givenDataset(content: Omit<SeedDataset, 'seedVersion'>): void;
  /** The asset fails validation (e.g. an unknown field value). */
  givenInvalidDataset(): void;
  /** Loading the asset throws (e.g. a broken bundle). */
  givenUnreadableDataset(): void;
}

/** Contract of `ExerciseSeedSource` (S1-11, S1-12). */
export const describeExerciseSeedSourceContract = defineContract<ExerciseSeedSourceFixture>(
  'ExerciseSeedSource',
  (fixture) => {
    it('exposes the manifest synchronously, with a positive seed version and an image base URL', () => {
      const { manifest } = fixture().source;

      expect(manifest.seedVersion).toBeGreaterThan(0);
      expect(manifest.imageBaseUrl).toMatch(/^https:\/\/.+\/$/);
      expect(manifest.source.name.length).toBeGreaterThan(0);
    });

    it('loads the dataset as domain values with the manifest seed version', async () => {
      const exercises = [
        aBuiltInExercise().named('Barbell Squat').buildData(),
        aBuiltInExercise()
          .named('Plank')
          .with({ equipment: null, force: null, images: [] })
          .buildData(),
      ];
      const vocabulary = [
        aVocabularyValue().ofKind('category').labelled('Strength').build(),
        aVocabularyValue().ofKind('muscle').labelled('Quadriceps').build(),
        aVocabularyValue().ofKind('muscle').labelled('Glutes').build(),
        aVocabularyValue().ofKind('muscle').labelled('Hamstrings').build(),
        aVocabularyValue().labelled('Barbell').build(),
      ];
      fixture().givenDataset({ exercises, vocabulary });

      const loaded = await fixture().source.loadDataset();

      expect(loaded).toEqual({
        ok: true,
        value: { seedVersion: fixture().source.manifest.seedVersion, exercises, vocabulary },
      });
    });

    it('returns exercises.seedAssetInvalid with a reason for an invalid asset', async () => {
      fixture().givenInvalidDataset();

      expect(await fixture().source.loadDataset()).toMatchObject({
        ok: false,
        error: {
          code: 'exercises.seedAssetInvalid',
          details: { reason: expect.any(String) as unknown },
        },
      });
    });

    it('resolves (never rejects) with exercises.seedAssetInvalid when the asset cannot be loaded', async () => {
      fixture().givenUnreadableDataset();

      expect(await fixture().source.loadDataset()).toMatchObject({
        ok: false,
        error: { code: 'exercises.seedAssetInvalid' },
      });
    });
  },
);
