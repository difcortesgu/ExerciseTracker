import { anExerciseDraft, existing, newValue } from '@test/builders/exercise-draft.builder';
import { builtInVocabularyValues, vocabularyKeyOf } from '@test/builders/exercise.builder';
import { unwrap, unwrapErr } from '@test/support/unwrap';

import {
  duplicateNameIssue,
  EXERCISE_LIMITS,
  formatInstructions,
  invalidExercise,
  parseInstructions,
  validateExerciseDraft,
} from './exercise-draft';
import { mergeVocabulary } from './vocabulary';

const vocabulary = mergeVocabulary(builtInVocabularyValues());

const issuesOf = (draft: ReturnType<ReturnType<typeof anExerciseDraft>['build']>) =>
  unwrapErr(validateExerciseDraft(draft, vocabulary)).issues;

describe('EXERCISE_LIMITS', () => {
  it('fixes the name, instructions and photo limits (S1-08, A5, A6)', () => {
    expect(EXERCISE_LIMITS).toEqual({
      nameMaxLength: 80,
      instructionsMaxLength: 5_000,
      photosMax: 6,
    });
    expect(Object.isFrozen(EXERCISE_LIMITS)).toBe(true);
  });
});

describe('parseInstructions / formatInstructions', () => {
  it('makes one step per line, normalised, blank lines dropped (A6)', () => {
    expect(parseInstructions('  Stand   tall \n\n \r\nSquat down\n')).toEqual([
      'Stand tall',
      'Squat down',
    ]);
  });

  it('returns no steps for empty text', () => {
    expect(parseInstructions('')).toEqual([]);
  });

  it('joins steps with a line break for the edit form', () => {
    expect(formatInstructions(['Stand tall', 'Squat down'])).toBe('Stand tall\nSquat down');
  });

  it('round-trips parsed steps', () => {
    const steps = parseInstructions('a\nb\nc');

    expect(parseInstructions(formatInstructions(steps))).toEqual(steps);
  });
});

describe('validateExerciseDraft', () => {
  it('accepts a valid draft and resolves every selection to a key', () => {
    const validated = unwrap(validateExerciseDraft(anExerciseDraft().build(), vocabulary));

    expect(validated).toEqual({
      name: 'My Goblet Squat',
      category: 'strength',
      primaryMuscles: ['quadriceps'],
      secondaryMuscles: ['glutes'],
      equipment: 'kettlebells',
      instructions: ['Hold the kettlebell at your chest.', 'Squat down and stand up.'],
      images: [],
      trackedMetrics: ['weight', 'reps'],
      newVocabularyValues: [],
    });
    expect(Object.isFrozen(validated)).toBe(true);
  });

  describe('name', () => {
    it('trims and collapses whitespace', () => {
      const draft = anExerciseDraft().named('  My   Goblet Squat ').build();

      expect(unwrap(validateExerciseDraft(draft, vocabulary)).name).toBe('My Goblet Squat');
    });

    it.each(['', '   '])('rejects the blank name %p with exercises.nameRequired', (name) => {
      expect(issuesOf(anExerciseDraft().named(name).build())).toEqual([
        expect.objectContaining({ field: 'name', code: 'exercises.nameRequired' }),
      ]);
    });

    it('accepts 80 characters and rejects 81 with exercises.nameTooLong', () => {
      const atLimit = 'a'.repeat(EXERCISE_LIMITS.nameMaxLength);

      expect(validateExerciseDraft(anExerciseDraft().named(atLimit).build(), vocabulary).ok).toBe(
        true,
      );
      expect(issuesOf(anExerciseDraft().named(`${atLimit}b`).build())).toEqual([
        expect.objectContaining({
          field: 'name',
          code: 'exercises.nameTooLong',
          details: { maximum: 80 },
        }),
      ]);
    });
  });

  describe('category', () => {
    it('requires a category', () => {
      expect(issuesOf(anExerciseDraft().with({ category: null }).build())).toEqual([
        expect.objectContaining({ field: 'category', code: 'exercises.categoryRequired' }),
      ]);
    });

    it('rejects an unknown category key', () => {
      expect(
        issuesOf(
          anExerciseDraft()
            .with({ category: existing('Unicorn') })
            .build(),
        ),
      ).toEqual([
        expect.objectContaining({
          field: 'category',
          code: 'exercises.unknownCategory',
          details: { key: 'unicorn' },
        }),
      ]);
    });

    it('reports an invalid new category value on the category field', () => {
      expect(
        issuesOf(
          anExerciseDraft()
            .with({ category: newValue(' ') })
            .build(),
        ),
      ).toEqual([
        expect.objectContaining({ field: 'category', code: 'exercises.vocabularyValueRequired' }),
      ]);
    });
  });

  describe('muscles', () => {
    it('requires at least one primary muscle (A3)', () => {
      expect(issuesOf(anExerciseDraft().with({ primaryMuscles: [] }).build())).toEqual([
        expect.objectContaining({
          field: 'primaryMuscles',
          code: 'exercises.primaryMuscleRequired',
        }),
      ]);
    });

    it('rejects an unknown muscle in the field where it was, with its index', () => {
      const draft = anExerciseDraft()
        .with({ secondaryMuscles: [existing('Glutes'), existing('Wings')] })
        .build();

      expect(issuesOf(draft)).toEqual([
        expect.objectContaining({
          field: 'secondaryMuscles',
          code: 'exercises.unknownMuscle',
          details: { key: 'wings', index: 1 },
        }),
      ]);
    });

    it('rejects a muscle listed as primary and secondary', () => {
      const draft = anExerciseDraft()
        .with({ secondaryMuscles: [existing('Glutes'), newValue('quadriceps')] })
        .build();

      expect(issuesOf(draft)).toEqual([
        expect.objectContaining({
          field: 'secondaryMuscles',
          code: 'exercises.muscleListedTwice',
          details: { key: 'quadriceps' },
        }),
      ]);
    });

    it('stores a muscle selected twice in one list once, in first-selection order', () => {
      const draft = anExerciseDraft()
        .with({
          primaryMuscles: [existing('Quadriceps'), existing('Chest'), newValue('QUADRICEPS')],
        })
        .build();

      expect(unwrap(validateExerciseDraft(draft, vocabulary)).primaryMuscles).toEqual([
        'quadriceps',
        'chest',
      ]);
    });

    it('allows no secondary muscles', () => {
      const draft = anExerciseDraft().with({ secondaryMuscles: [] }).build();

      expect(unwrap(validateExerciseDraft(draft, vocabulary)).secondaryMuscles).toEqual([]);
    });
  });

  describe('equipment', () => {
    it('is optional', () => {
      const draft = anExerciseDraft().with({ equipment: null }).build();

      expect(unwrap(validateExerciseDraft(draft, vocabulary)).equipment).toBeNull();
    });

    it('rejects an unknown equipment key', () => {
      expect(
        issuesOf(
          anExerciseDraft()
            .with({ equipment: existing('Rocket') })
            .build(),
        ),
      ).toEqual([
        expect.objectContaining({ field: 'equipment', code: 'exercises.unknownEquipment' }),
      ]);
    });
  });

  describe('user-defined values (S1-29)', () => {
    it('returns new values once, keyed and normalised, to persist with the exercise', () => {
      const draft = anExerciseDraft()
        .with({
          category: newValue('Core'),
          primaryMuscles: [newValue('Serratus'), newValue(' serratus ')],
          secondaryMuscles: [],
          equipment: newValue('  Sand   bag'),
        })
        .build();

      const validated = unwrap(validateExerciseDraft(draft, vocabulary));

      expect(validated).toMatchObject({
        category: 'core',
        primaryMuscles: ['serratus'],
        equipment: 'sand bag',
      });
      expect(validated.newVocabularyValues).toEqual([
        { kind: 'category', key: 'core', label: 'Core', origin: 'custom' },
        { kind: 'muscle', key: 'serratus', label: 'Serratus', origin: 'custom' },
        { kind: 'equipment', key: 'sand bag', label: 'Sand bag', origin: 'custom' },
      ]);
    });

    it('reuses a built-in value typed as a new one, without creating a value', () => {
      const draft = anExerciseDraft()
        .with({ equipment: newValue('BARBELL') })
        .build();

      const validated = unwrap(validateExerciseDraft(draft, vocabulary));

      expect(validated.equipment).toBe(vocabularyKeyOf('Barbell'));
      expect(validated.newVocabularyValues).toEqual([]);
    });
  });

  describe('instructions', () => {
    it('are optional', () => {
      const draft = anExerciseDraft().with({ instructionsText: ' \n ' }).build();

      expect(unwrap(validateExerciseDraft(draft, vocabulary)).instructions).toEqual([]);
    });

    it('accept 5 000 characters in total and reject more', () => {
      const atLimit = 'a'.repeat(EXERCISE_LIMITS.instructionsMaxLength);

      expect(
        validateExerciseDraft(
          anExerciseDraft().with({ instructionsText: atLimit }).build(),
          vocabulary,
        ).ok,
      ).toBe(true);
      expect(
        issuesOf(
          anExerciseDraft()
            .with({ instructionsText: `${atLimit}b` })
            .build(),
        ),
      ).toEqual([
        expect.objectContaining({
          field: 'instructions',
          code: 'exercises.instructionsTooLong',
          details: { maximum: 5_000 },
        }),
      ]);
    });
  });

  describe('photos', () => {
    it('keeps photos in order as app-owned custom photos', () => {
      const draft = anExerciseDraft().withPhotos('b.jpg', 'a.jpg').build();

      expect(unwrap(validateExerciseDraft(draft, vocabulary)).images).toEqual([
        { kind: 'photo', fileName: 'b.jpg' },
        { kind: 'photo', fileName: 'a.jpg' },
      ]);
    });

    it('stores a photo listed twice once', () => {
      const draft = anExerciseDraft().withPhotos('a.jpg', 'a.jpg').build();

      expect(unwrap(validateExerciseDraft(draft, vocabulary)).images).toHaveLength(1);
    });

    it('accepts 6 photos and rejects 7 (A5)', () => {
      const names = (count: number) =>
        Array.from({ length: count }, (_u, index) => `p${index}.jpg`);

      expect(
        validateExerciseDraft(
          anExerciseDraft()
            .withPhotos(...names(6))
            .build(),
          vocabulary,
        ).ok,
      ).toBe(true);
      expect(
        issuesOf(
          anExerciseDraft()
            .withPhotos(...names(7))
            .build(),
        ),
      ).toEqual([
        expect.objectContaining({
          field: 'photos',
          code: 'exercises.tooManyPhotos',
          details: { maximum: 6 },
        }),
      ]);
    });
  });

  describe('tracked metrics', () => {
    it('requires at least one', () => {
      expect(issuesOf(anExerciseDraft().with({ trackedMetrics: [] }).build())).toEqual([
        expect.objectContaining({ field: 'trackedMetrics', code: 'exercises.noTrackedMetric' }),
      ]);
    });

    it('stores them de-duplicated in canonical order', () => {
      const draft = anExerciseDraft()
        .with({ trackedMetrics: ['rpe', 'reps', 'rpe', 'weight'] })
        .build();

      expect(unwrap(validateExerciseDraft(draft, vocabulary)).trackedMetrics).toEqual([
        'weight',
        'reps',
        'rpe',
      ]);
    });
  });

  it('returns every field problem at once, not only the first', () => {
    const draft = anExerciseDraft()
      .named('')
      .with({
        category: null,
        primaryMuscles: [],
        equipment: existing('Rocket'),
        trackedMetrics: [],
      })
      .withPhotos('1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg', '6.jpg', '7.jpg')
      .build();

    const error = unwrapErr(validateExerciseDraft(draft, vocabulary));

    expect(error.code).toBe('exercises.invalidExercise');
    expect(error.issues.map(({ code }) => code)).toEqual([
      'exercises.nameRequired',
      'exercises.categoryRequired',
      'exercises.primaryMuscleRequired',
      'exercises.unknownEquipment',
      'exercises.tooManyPhotos',
      'exercises.noTrackedMetric',
    ]);
    error.issues.forEach((issue) => expect(issue.message).toMatch(/\S/));
  });
});

describe('invalidExercise and duplicateNameIssue', () => {
  it('build the error the create/update use cases return for a taken name', () => {
    const error = invalidExercise([duplicateNameIssue('Barbell Squat')]);

    expect(error).toEqual({
      code: 'exercises.invalidExercise',
      message: expect.stringMatching(/\S/) as unknown,
      issues: [
        {
          field: 'name',
          code: 'exercises.duplicateName',
          message: "'Barbell Squat' already exists.",
          details: { existingName: 'Barbell Squat' },
        },
      ],
    });
    expect(Object.isFrozen(error.issues)).toBe(true);
  });
});
