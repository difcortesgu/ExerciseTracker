import { useEffect, useState } from 'react';

import { useDependency } from '@core/presentation';

import type { ExerciseImageRef, ImageSource } from '../application/exercise-dtos';
import { GetExerciseImageToken } from '../application/get-exercise-image';

/** What an image slot shows: nothing to fetch, a fetch in progress, or the use case's answer. */
export type ExerciseImageState =
  { readonly status: 'none' } | { readonly status: 'loading' } | ImageSource;

const NONE: ExerciseImageState = Object.freeze({ status: 'none' });
const LOADING: ExerciseImageState = Object.freeze({ status: 'loading' });

interface Fetched {
  readonly image: ExerciseImageRef;
  readonly source: ImageSource;
}

/**
 * View-model hook (MVVM) of one image slot (S1-17, S1-18, S1-22): asks `GetExerciseImage` for
 * something displayable. The use case decides between cache, download and placeholder; this hook
 * only tracks which image the answer belongs to, so a recycled list row never shows the previous
 * row's image. Only mounted slots ask, so a virtualised list fetches visible rows only.
 */
export function useExerciseImage(image: ExerciseImageRef | null): ExerciseImageState {
  const getExerciseImage = useDependency(GetExerciseImageToken);
  const [fetched, setFetched] = useState<Fetched | null>(null);

  useEffect(() => {
    if (image === null) {
      return undefined;
    }
    let isMounted = true;
    getExerciseImage(image).then(
      (source) => {
        if (isMounted) {
          setFetched({ image, source });
        }
      },
      (reason: unknown) =>
        setFetched(() => {
          throw reason;
        }),
    );
    return () => {
      isMounted = false;
    };
  }, [getExerciseImage, image]);

  if (image === null) {
    return NONE;
  }
  return fetched?.image === image ? fetched.source : LOADING;
}
