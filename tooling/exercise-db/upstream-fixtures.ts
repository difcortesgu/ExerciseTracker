/**
 * Test data for the dataset conversion tests (S1-11): upstream free-exercise-db records and the
 * GitHub git-tree listing that carries the image sizes. Valid by default; tests override only what
 * matters (builder style, test/builders/README.md).
 */

export interface UpstreamExercise {
  readonly id: string;
  readonly name: string;
  readonly force?: string | null;
  readonly level: string;
  readonly mechanic?: string | null;
  readonly equipment?: string | null;
  readonly primaryMuscles: readonly string[];
  readonly secondaryMuscles: readonly string[];
  readonly instructions: readonly string[];
  readonly category: string;
  readonly images: readonly string[];
}

export const DEFAULT_IMAGE_BYTES = 50_000;

export const anUpstreamExercise = (overrides: Partial<UpstreamExercise> = {}): UpstreamExercise => {
  const id = overrides.id ?? 'Barbell_Squat';
  return {
    id,
    name: 'Barbell Squat',
    force: 'push',
    level: 'beginner',
    mechanic: 'compound',
    equipment: 'barbell',
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: ['glutes', 'hamstrings'],
    instructions: ['Stand under the bar.', 'Squat down.'],
    category: 'strength',
    images: [`${id}/0.jpg`, `${id}/1.jpg`],
    ...overrides,
  };
};

/** The same record without the optional keys at all (the upstream schema allows them to be missing). */
export const withoutOptionalAttributes = (exercise: UpstreamExercise): UpstreamExercise => {
  const { force: _force, mechanic: _mechanic, equipment: _equipment, ...required } = exercise;
  return required;
};

export interface TreeEntry {
  readonly path: string;
  readonly type: 'blob' | 'tree';
  readonly size?: number;
}

/** A git-tree listing containing every image of `exercises` (each `DEFAULT_IMAGE_BYTES` unless given). */
export const aTreeFor = (
  exercises: readonly UpstreamExercise[],
  sizes: Readonly<Record<string, number>> = {},
): { readonly truncated: boolean; readonly tree: readonly TreeEntry[] } => ({
  truncated: false,
  tree: [
    { path: 'exercises', type: 'tree' },
    ...exercises.flatMap((exercise) =>
      exercise.images.map((image) => ({
        path: `exercises/${image}`,
        type: 'blob' as const,
        size: sizes[image] ?? DEFAULT_IMAGE_BYTES,
      })),
    ),
  ],
});
