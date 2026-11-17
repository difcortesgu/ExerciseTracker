import { comparisonKey } from '@modules/exercises/domain/comparison-key';
import {
  parseDatasetImagePath,
  parsePhotoFileName,
  parseSeedSourceKey,
  type BuiltInExercise,
  type BuiltInExerciseData,
  type BuiltInImage,
  type CustomExercise,
  type CustomPhoto,
} from '@modules/exercises/domain/exercise';
import type { ExerciseSummary } from '@modules/exercises/domain/exercise-summary';
import type {
  VocabularyKey,
  VocabularyKind,
  VocabularyValue,
} from '@modules/exercises/domain/vocabulary';
import { parseExerciseId, type ExerciseId } from '@shared/domain/ids';

import { unwrap } from '../support/unwrap';

import { nextId } from './builder-support';

/**
 * Builders (object mothers) of the exercises domain (Sprint 1). Defaults are valid, realistic
 * values from the pinned dataset ("Barbell Squat"); branded values come from the domain's parse
 * functions and `comparisonKey`, never from casts. Every method returns a new builder.
 */

const DEFAULT_IMAGE_SIZE_BYTES = 56_500;
const IMAGES_PER_BUILT_IN = 2;

/** The vocabulary key of a label (its comparison key), e.g. `vocabularyKeyOf('Body only')`. */
export const vocabularyKeyOf = (label: string): VocabularyKey => comparisonKey(label);

export const exerciseIdOf = (raw: string): ExerciseId => unwrap(parseExerciseId(raw));

const nextExerciseId = (): ExerciseId => exerciseIdOf(nextId('exercise'));

/** The dataset's id for a name: spaces become underscores ("Barbell Squat" → `Barbell_Squat`). */
const sourceKeyFor = (name: string) =>
  unwrap(parseSeedSourceKey(name.replace(/[^A-Za-z0-9_.-]+/g, '_')));

export const aBuiltInImage = (path: string, sizeBytes = DEFAULT_IMAGE_SIZE_BYTES): BuiltInImage =>
  Object.freeze({ kind: 'builtIn', path: unwrap(parseDatasetImagePath(path)), sizeBytes });

export const aCustomPhoto = (fileName: string): CustomPhoto =>
  Object.freeze({ kind: 'photo', fileName: unwrap(parsePhotoFileName(fileName)) });

const datasetImagesFor = (name: string): readonly BuiltInImage[] =>
  Array.from({ length: IMAGES_PER_BUILT_IN }, (_unused, index) =>
    aBuiltInImage(`${sourceKeyFor(name)}/${index}.jpg`),
  );

const keys = (...labels: readonly string[]): readonly VocabularyKey[] =>
  Object.freeze(labels.map(vocabularyKeyOf));

/** Shallow-frozen copy with frozen list fields, like the domain factories return. */
function frozen<T extends object>(value: T): T {
  const copy = { ...value };
  for (const field of Object.values(copy)) {
    if (Array.isArray(field)) Object.freeze(field);
  }
  return Object.freeze(copy);
}

const DEFAULT_INSTRUCTIONS = Object.freeze([
  'Set the bar on your upper back and stand with your feet shoulder-width apart.',
  'Squat down until your thighs are parallel to the floor, then stand back up.',
]);

export class BuiltInExerciseBuilder {
  constructor(private readonly fields: BuiltInExercise) {}

  with(overrides: Partial<BuiltInExercise>): BuiltInExerciseBuilder {
    return new BuiltInExerciseBuilder({ ...this.fields, ...overrides });
  }

  withId(id: string): BuiltInExerciseBuilder {
    return this.with({ id: exerciseIdOf(id) });
  }

  /** Renames it and derives the dataset key and image paths from the new name. */
  named(name: string): BuiltInExerciseBuilder {
    return this.with({ name, sourceKey: sourceKeyFor(name), images: datasetImagesFor(name) });
  }

  archived(): BuiltInExerciseBuilder {
    return this.with({ archived: true });
  }

  build(): BuiltInExercise {
    return frozen(this.fields);
  }

  /** The exercise as the seed describes it (no id, no derived tracked metrics, S1-12). */
  buildData(): BuiltInExerciseData {
    const { sourceKey, name, category, primaryMuscles, secondaryMuscles, equipment } = this.fields;
    const { level, force, mechanic, instructions, images } = this.fields;
    return frozen({
      sourceKey,
      name,
      category,
      primaryMuscles,
      secondaryMuscles,
      equipment,
      level,
      force,
      mechanic,
      instructions,
      images,
    });
  }
}

export const aBuiltInExercise = (): BuiltInExerciseBuilder =>
  new BuiltInExerciseBuilder({
    id: nextExerciseId(),
    origin: 'builtIn',
    sourceKey: sourceKeyFor('Barbell Squat'),
    name: 'Barbell Squat',
    category: vocabularyKeyOf('strength'),
    primaryMuscles: keys('quadriceps'),
    secondaryMuscles: keys('glutes', 'hamstrings'),
    equipment: vocabularyKeyOf('barbell'),
    level: 'beginner',
    force: 'push',
    mechanic: 'compound',
    instructions: DEFAULT_INSTRUCTIONS,
    images: datasetImagesFor('Barbell Squat'),
    trackedMetrics: Object.freeze(['weight', 'reps'] as const),
    archived: false,
  });

export class CustomExerciseBuilder {
  constructor(private readonly fields: CustomExercise) {}

  with(overrides: Partial<CustomExercise>): CustomExerciseBuilder {
    return new CustomExerciseBuilder({ ...this.fields, ...overrides });
  }

  withId(id: string): CustomExerciseBuilder {
    return this.with({ id: exerciseIdOf(id) });
  }

  named(name: string): CustomExerciseBuilder {
    return this.with({ name });
  }

  withPhotos(...fileNames: readonly string[]): CustomExerciseBuilder {
    return this.with({ images: Object.freeze(fileNames.map(aCustomPhoto)) });
  }

  archived(): CustomExerciseBuilder {
    return this.with({ archived: true });
  }

  build(): CustomExercise {
    return frozen(this.fields);
  }
}

export const aCustomExercise = (): CustomExerciseBuilder =>
  new CustomExerciseBuilder({
    id: nextExerciseId(),
    origin: 'custom',
    name: 'My Goblet Squat',
    category: vocabularyKeyOf('strength'),
    primaryMuscles: keys('quadriceps'),
    secondaryMuscles: keys('glutes'),
    equipment: vocabularyKeyOf('kettlebells'),
    instructions: Object.freeze(['Hold the kettlebell at your chest.', 'Squat down and stand up.']),
    images: Object.freeze([]),
    trackedMetrics: Object.freeze(['weight', 'reps'] as const),
    archived: false,
  });

export class ExerciseSummaryBuilder {
  constructor(private readonly fields: ExerciseSummary) {}

  with(overrides: Partial<ExerciseSummary>): ExerciseSummaryBuilder {
    return new ExerciseSummaryBuilder({ ...this.fields, ...overrides });
  }

  withId(id: string): ExerciseSummaryBuilder {
    return this.with({ id: exerciseIdOf(id) });
  }

  named(name: string): ExerciseSummaryBuilder {
    return this.with({ name });
  }

  build(): ExerciseSummary {
    return frozen(this.fields);
  }
}

export const anExerciseSummary = (): ExerciseSummaryBuilder => {
  const { id, name, origin, category, primaryMuscles, equipment, images } =
    aBuiltInExercise().build();
  return new ExerciseSummaryBuilder({
    id,
    name,
    origin,
    category,
    primaryMuscles,
    equipment,
    coverImage: images[0] ?? null,
  });
};

export class VocabularyValueBuilder {
  constructor(private readonly fields: VocabularyValue) {}

  ofKind(kind: VocabularyKind): VocabularyValueBuilder {
    return new VocabularyValueBuilder({ ...this.fields, kind });
  }

  /** Sets the label and the key derived from it. */
  labelled(label: string): VocabularyValueBuilder {
    return new VocabularyValueBuilder({ ...this.fields, label, key: vocabularyKeyOf(label) });
  }

  custom(): VocabularyValueBuilder {
    return new VocabularyValueBuilder({ ...this.fields, origin: 'custom' });
  }

  build(): VocabularyValue {
    return Object.freeze({ ...this.fields });
  }
}

export const aVocabularyValue = (): VocabularyValueBuilder =>
  new VocabularyValueBuilder({
    kind: 'equipment',
    key: vocabularyKeyOf('Barbell'),
    label: 'Barbell',
    origin: 'builtIn',
  });

export const VOCABULARY_KINDS: readonly VocabularyKind[] = ['category', 'muscle', 'equipment'];

const BUILT_IN_LABELS: Readonly<Record<VocabularyKind, readonly string[]>> = {
  category: ['Cardio', 'Plyometrics', 'Powerlifting', 'Strength', 'Stretching'],
  muscle: ['Abdominals', 'Biceps', 'Chest', 'Glutes', 'Hamstrings', 'Quadriceps'],
  equipment: ['Barbell', 'Body only', 'Dumbbell', 'Kettlebells'],
};

/** Built-in vocabulary values covering every key the exercise builders use (unmerged, as stored). */
export const builtInVocabularyValues = (): readonly VocabularyValue[] =>
  Object.freeze(
    VOCABULARY_KINDS.flatMap((kind) =>
      BUILT_IN_LABELS[kind].map((label) => aVocabularyValue().ofKind(kind).labelled(label).build()),
    ),
  );
