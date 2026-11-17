import { convertDataset } from './convert';
import {
  anUpstreamExercise,
  aTreeFor,
  DEFAULT_IMAGE_BYTES,
  withoutOptionalAttributes,
  type UpstreamExercise,
} from './upstream-fixtures';

const convert = (exercises: readonly UpstreamExercise[], tree: unknown = aTreeFor(exercises)) =>
  convertDataset({ upstream: exercises, tree });

const convertedExercises = (exercises: readonly UpstreamExercise[]) => {
  const result = convert(exercises);
  if (!result.ok) {
    throw new Error(`Expected a successful conversion, got: ${result.errors.join('; ')}`);
  }
  return result.value.exercises;
};

const errorsOf = (exercises: readonly UpstreamExercise[], tree?: unknown): readonly string[] => {
  const result = convert(exercises, tree);
  return result.ok ? [] : result.errors;
};

describe('convertDataset: valid records', () => {
  it('maps an upstream record to a seed exercise with a stable source key and sized images', () => {
    const [exercise] = convertedExercises([anUpstreamExercise()]);

    expect(exercise).toEqual({
      key: 'Barbell_Squat',
      name: 'Barbell Squat',
      category: 'strength',
      equipment: 'barbell',
      level: 'beginner',
      force: 'push',
      mechanic: 'compound',
      primaryMuscles: ['quadriceps'],
      secondaryMuscles: ['glutes', 'hamstrings'],
      instructions: ['Stand under the bar.', 'Squat down.'],
      images: [
        { path: 'Barbell_Squat/0.jpg', sizeBytes: DEFAULT_IMAGE_BYTES },
        { path: 'Barbell_Squat/1.jpg', sizeBytes: DEFAULT_IMAGE_BYTES },
      ],
    });
  });

  it('treats missing optional attributes (force, mechanic, equipment) as null', () => {
    const [exercise] = convertedExercises([withoutOptionalAttributes(anUpstreamExercise())]);

    expect(exercise).toMatchObject({ force: null, mechanic: null, equipment: null });
  });

  it('keeps an explicit null equipment', () => {
    const [exercise] = convertedExercises([anUpstreamExercise({ equipment: null })]);

    expect(exercise?.equipment).toBeNull();
  });

  it('accepts an exercise without images or instructions', () => {
    const [exercise] = convertedExercises([anUpstreamExercise({ images: [], instructions: [] })]);

    expect(exercise).toMatchObject({ images: [], instructions: [] });
  });

  it('normalises whitespace in names and instructions and drops empty steps', () => {
    const [exercise] = convertedExercises([
      anUpstreamExercise({ name: '  Barbell   Squat ', instructions: ['  Brace. ', '   ', ''] }),
    ]);

    expect(exercise).toMatchObject({ name: 'Barbell Squat', instructions: ['Brace.'] });
  });

  it('removes a muscle from the secondary list when it is also primary, and reports it', () => {
    const result = convert([
      anUpstreamExercise({
        primaryMuscles: ['quadriceps'],
        secondaryMuscles: ['quadriceps', 'glutes'],
      }),
    ]);

    expect(result.ok && result.value.exercises[0]?.secondaryMuscles).toEqual(['glutes']);
    expect(result.ok && result.value.notes).toEqual([
      'Barbell_Squat: removed secondary muscle(s) also listed as primary: quadriceps',
    ]);
  });

  it('sorts exercises by source key so re-runs produce stable diffs', () => {
    const exercises = convertedExercises([
      anUpstreamExercise({ id: 'Zercher_Squat', name: 'Zercher Squat' }),
      anUpstreamExercise({ id: 'Air_Bike', name: 'Air Bike' }),
    ]);

    expect(exercises.map((exercise) => exercise.key)).toEqual(['Air_Bike', 'Zercher_Squat']);
  });

  it('lists the vocabulary values in use, sorted, with display labels', () => {
    const result = convert([
      anUpstreamExercise({ equipment: 'body only', secondaryMuscles: ['lower back'] }),
    ]);

    expect(result.ok && result.value.vocabulary).toEqual({
      category: [{ key: 'strength', label: 'Strength' }],
      muscle: [
        { key: 'lower back', label: 'Lower back' },
        { key: 'quadriceps', label: 'Quadriceps' },
      ],
      equipment: [{ key: 'body only', label: 'Body only' }],
    });
  });
});

describe('convertDataset: rejected input (the script fails with a clear message)', () => {
  it('rejects input that is not a list of exercises', () => {
    expect(convertDataset({ upstream: { exercises: [] }, tree: aTreeFor([]) })).toEqual({
      ok: false,
      errors: ['The upstream dataset must be a JSON array of exercises.'],
    });
  });

  it('rejects a truncated or malformed git tree listing', () => {
    const exercises = [anUpstreamExercise()];

    expect(errorsOf(exercises, { truncated: true, tree: [] })).toEqual([
      'The git tree listing must be complete (GitHub "truncated": false) with a "tree" array.',
    ]);
    expect(errorsOf(exercises, null)).toHaveLength(1);
  });

  it('rejects a record that is not an object', () => {
    expect(convertDataset({ upstream: [42], tree: aTreeFor([]) })).toEqual({
      ok: false,
      errors: ['#0: not an object.'],
    });
  });

  it.each([
    ['id', { id: '  ' }, '#0: "id" must be a non-empty string.'],
    ['name', { name: '' }, 'Barbell_Squat: "name" must be a non-empty string.'],
    [
      'instructions',
      { instructions: 'Squat.' },
      'Barbell_Squat: "instructions" must be a list of strings.',
    ],
    ['images', { images: [1] }, 'Barbell_Squat: "images" must be a list of strings.'],
    [
      'primary muscles',
      { primaryMuscles: 'quadriceps' },
      'Barbell_Squat: "primaryMuscles" must be a list of strings.',
    ],
  ])('rejects a malformed %s field', (_field, override, message) => {
    const exercise: unknown = { ...anUpstreamExercise(), ...override };

    expect(
      convertDataset({ upstream: [exercise], tree: aTreeFor([anUpstreamExercise()]) }),
    ).toEqual({
      ok: false,
      errors: [message],
    });
  });

  it('rejects an empty primary muscle list (every built-in must be findable by muscle)', () => {
    expect(errorsOf([anUpstreamExercise({ primaryMuscles: [] })])).toEqual([
      'Barbell_Squat: needs at least one primary muscle.',
    ]);
  });

  it.each([
    ['category', { category: 'yoga' }, 'Barbell_Squat: unknown category "yoga".'],
    ['muscle', { secondaryMuscles: ['core'] }, 'Barbell_Squat: unknown muscle "core".'],
    ['equipment', { equipment: 'sandbag' }, 'Barbell_Squat: unknown equipment "sandbag".'],
    ['level', { level: 'elite' }, 'Barbell_Squat: unknown level "elite".'],
    ['force', { force: 'twist' }, 'Barbell_Squat: unknown force "twist".'],
    ['mechanic', { mechanic: 'hybrid' }, 'Barbell_Squat: unknown mechanic "hybrid".'],
  ])('rejects an unknown %s value', (_field, override, message) => {
    expect(errorsOf([anUpstreamExercise(override)])).toEqual([expect.stringContaining(message)]);
  });

  it('names the allowed values when a vocabulary value is unknown', () => {
    expect(errorsOf([anUpstreamExercise({ equipment: 'sandbag' })])[0]).toContain(
      'Add it to tooling/exercise-db/pin.js if it is a new built-in value.',
    );
  });

  it('rejects duplicate source keys', () => {
    const errors = errorsOf([anUpstreamExercise(), anUpstreamExercise({ name: 'Another Squat' })]);

    expect(errors).toEqual(['Barbell_Squat: duplicate id.']);
  });

  it('rejects names that the app would consider equal (case, accents, spacing)', () => {
    const errors = errorsOf([
      anUpstreamExercise({ id: 'A', name: 'Barbell Squat', images: [] }),
      anUpstreamExercise({ id: 'B', name: '  barbell  SQUÁT', images: [] }),
    ]);

    expect(errors).toEqual(['B: name "barbell SQUÁT" duplicates the name of A.']);
  });

  it('rejects an image that does not exist in the pinned tree', () => {
    const exercise = anUpstreamExercise();

    expect(
      errorsOf([exercise], aTreeFor([anUpstreamExercise({ images: ['Barbell_Squat/0.jpg'] })])),
    ).toEqual(['Barbell_Squat: image "Barbell_Squat/1.jpg" is not in the pinned tree.']);
  });

  it('only takes image sizes from the upstream exercises/ folder', () => {
    const exercise = anUpstreamExercise({ images: ['Barbell_Squat/0.jpg'] });
    const tree = {
      truncated: false,
      tree: [{ path: 'dist/Barbell_Squat/0.jpg', type: 'blob', size: DEFAULT_IMAGE_BYTES }],
    };

    expect(errorsOf([exercise], tree)).toEqual([
      'Barbell_Squat: image "Barbell_Squat/0.jpg" is not in the pinned tree.',
    ]);
  });

  it('reports every problem of every record, not only the first', () => {
    const errors = errorsOf([
      anUpstreamExercise({ id: 'A', category: 'yoga', equipment: 'sandbag', images: [] }),
      anUpstreamExercise({ id: 'B', name: 'Other', primaryMuscles: [], images: [] }),
    ]);

    expect(errors).toHaveLength(3);
  });
});
