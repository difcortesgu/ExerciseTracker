import type { Href } from 'expo-router';

import type { ExerciseId } from '@shared/domain/ids';

/**
 * Where the exercise screens live (`app/exercises/**`, `app/(tabs)/settings.tsx`). One place for
 * the paths, so screens never build URLs by hand.
 */
export const exerciseRoutes = Object.freeze({
  detail: (id: ExerciseId): Href => ({ pathname: '/exercises/[id]', params: { id } }),
  edit: (id: ExerciseId): Href => ({ pathname: '/exercises/[id]/edit', params: { id } }),
  create: (): Href => '/exercises/new',
  /** Create form prefilled from a built-in (S1-23). */
  duplicate: (id: ExerciseId): Href => ({
    pathname: '/exercises/new',
    params: { duplicateOf: id },
  }),
  /** Settings tab, where "Offline images" lives (S1-28, T8). */
  offlineImages: (): Href => '/settings',
});
