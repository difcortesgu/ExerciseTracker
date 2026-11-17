import { anExerciseDraft, newValue } from '@test/builders/exercise-draft.builder';
import {
  aBuiltInExercise,
  aCustomExercise,
  builtInVocabularyValues,
  exerciseIdOf,
  vocabularyKeyOf,
} from '@test/builders/exercise.builder';
import { unwrap, unwrapErr } from '@test/support/unwrap';

import {
  archiveExercise,
  createBuiltInExercise,
  createCustomExercise,
  isCustomExercise,
  parseDatasetImagePath,
  parsePhotoFileName,
  parseSeedSourceKey,
  requireCustomExercise,
  reviseCustomExercise,
  updateCustomExercise,
} from './exercise';
import { validateExerciseDraft, type ExerciseDraft } from './exercise-draft';
import { mergeVocabulary } from './vocabulary';

const vocabulary = mergeVocabulary(builtInVocabularyValues());
const validated = (draft: ExerciseDraft = anExerciseDraft().build()) =>
  unwrap(validateExerciseDraft(draft, vocabulary));

describe('parseSeedSourceKey', () => {
  it.each(['Barbell_Squat', '3_4_Sit-Up', 'Ab_Roller'])('accepts the dataset id %p', (raw) => {
    expect(unwrap(parseSeedSourceKey(raw))).toBe(raw);
  });

  it.each(['', ' ', 'Barbell Squat', 'a/b', '.', '..', 'Squat\n'])(
    'rejects %p with exercises.invalidSeedSourceKey',
    (raw) => {
      expect(unwrapErr(parseSeedSourceKey(raw))).toEqual({
        code: 'exercises.invalidSeedSourceKey',
        message: expect.stringMatching(/\S/) as unknown,
        details: { value: raw },
      });
    },
  );
});

describe('parseDatasetImagePath', () => {
  it.each(['Barbell_Squat/0.jpg', '3_4_Sit-Up/1.jpg', 'a.jpg', 'a/b/c.jpeg'])(
    'accepts the dataset path %p',
    (raw) => {
      expect(unwrap(parseDatasetImagePath(raw))).toBe(raw);
    },
  );

  it.each(['', '/Squat/0.jpg', 'Squat/', 'Squat//0.jpg', '../0.jpg', 'Squat/./0.jpg', 'a b/0.jpg'])(
    'rejects %p with exercises.invalidDatasetImagePath',
    (raw) => {
      expect(unwrapErr(parseDatasetImagePath(raw))).toMatchObject({
        code: 'exercises.invalidDatasetImagePath',
        details: { value: raw },
      });
    },
  );
});

describe('parsePhotoFileName', () => {
  it.each(['9b2f6c1e-0d7a.jpg', 'photo_1.jpg', 'A.jpg'])('accepts %p', (raw) => {
    expect(unwrap(parsePhotoFileName(raw))).toBe(raw);
  });

  it.each(['', '.jpg', 'photo.png', 'photo.JPG', 'dir/photo.jpg', 'pho to.jpg', 'photo.jpg.part'])(
    'rejects %p with exercises.invalidPhotoFileName',
    (raw) => {
      expect(unwrapErr(parsePhotoFileName(raw))).toMatchObject({
        code: 'exercises.invalidPhotoFileName',
        details: { value: raw },
      });
    },
  );
});

describe('isCustomExercise', () => {
  it('derives isCustom from the origin (PLAN §3)', () => {
    expect(isCustomExercise(aCustomExercise().build())).toBe(true);
    expect(isCustomExercise(aBuiltInExercise().build())).toBe(false);
  });
});

describe('createCustomExercise', () => {
  it('creates an active, frozen custom exercise from a validated draft', () => {
    const draft = anExerciseDraft()
      .withPhotos('a.jpg')
      .with({ equipment: newValue('Sandbag') });

    const exercise = createCustomExercise(exerciseIdOf('custom-1'), validated(draft.build()));

    expect(exercise).toEqual({
      id: 'custom-1',
      origin: 'custom',
      name: 'My Goblet Squat',
      category: 'strength',
      primaryMuscles: ['quadriceps'],
      secondaryMuscles: ['glutes'],
      equipment: 'sandbag',
      instructions: ['Hold the kettlebell at your chest.', 'Squat down and stand up.'],
      images: [{ kind: 'photo', fileName: 'a.jpg' }],
      trackedMetrics: ['weight', 'reps'],
      archived: false,
    });
    expect(Object.isFrozen(exercise)).toBe(true);
  });
});

describe('updateCustomExercise', () => {
  it('returns a new instance with the changes, keeping id, origin and archived flag', () => {
    const original = aCustomExercise().withId('custom-1').build();

    const updated = unwrap(
      updateCustomExercise(original, validated(anExerciseDraft().named('Goblet Squat').build())),
    );

    expect(updated).toMatchObject({
      id: 'custom-1',
      origin: 'custom',
      name: 'Goblet Squat',
      archived: false,
    });
    expect(original.name).toBe('My Goblet Squat');
    expect(Object.isFrozen(updated)).toBe(true);
  });

  it('refuses to change a built-in (decision Q2)', () => {
    const builtIn = aBuiltInExercise().build();

    expect(unwrapErr(updateCustomExercise(builtIn, validated()))).toEqual({
      code: 'exercises.builtInReadOnly',
      message: expect.stringMatching(/\S/) as unknown,
      details: { id: builtIn.id },
    });
  });
});

describe('reviseCustomExercise', () => {
  it('returns a new instance with the edited fields, keeping id, origin and archived flag', () => {
    const original = aCustomExercise().named('Old name').build();

    const revised = reviseCustomExercise(
      original,
      validated(anExerciseDraft().named('New').build()),
    );

    expect(revised).toMatchObject({
      id: original.id,
      origin: 'custom',
      name: 'New',
      archived: false,
    });
    expect(original.name).toBe('Old name');
    expect(Object.isFrozen(revised)).toBe(true);
  });
});

describe('requireCustomExercise', () => {
  it('returns a custom exercise unchanged', () => {
    const custom = aCustomExercise().build();

    expect(unwrap(requireCustomExercise(custom))).toBe(custom);
  });

  it('refuses a built-in with exercises.builtInReadOnly naming its id (Q2)', () => {
    const builtIn = aBuiltInExercise().build();

    expect(unwrapErr(requireCustomExercise(builtIn))).toEqual({
      code: 'exercises.builtInReadOnly',
      message: 'Built-in exercises cannot be changed.',
      details: { id: builtIn.id },
    });
  });
});

describe('archiveExercise', () => {
  it('archives a custom exercise as a new instance, keeping every other field', () => {
    const original = aCustomExercise().withPhotos('a.jpg').build();

    const archived = unwrap(archiveExercise(original));

    expect(archived).toEqual({ ...original, archived: true });
    expect(original.archived).toBe(false);
    expect(Object.isFrozen(archived)).toBe(true);
  });

  it('refuses to archive a built-in', () => {
    expect(unwrapErr(archiveExercise(aBuiltInExercise().build())).code).toBe(
      'exercises.builtInReadOnly',
    );
  });
});

describe('createBuiltInExercise', () => {
  it('creates an active built-in with default tracked metrics (S1-10)', () => {
    const data = aBuiltInExercise().named('Push-Up').with({ equipment: null }).buildData();

    const exercise = createBuiltInExercise(exerciseIdOf('b-1'), data);

    expect(exercise).toEqual({
      ...data,
      id: 'b-1',
      origin: 'builtIn',
      trackedMetrics: ['weight', 'reps'],
      archived: false,
    });
    expect(Object.isFrozen(exercise)).toBe(true);
  });

  it('derives the metrics from the category and equipment', () => {
    const data = aBuiltInExercise()
      .with({ equipment: vocabularyKeyOf('body only') })
      .buildData();

    expect(createBuiltInExercise(exerciseIdOf('b-2'), data).trackedMetrics).toEqual(['reps']);
  });
});
