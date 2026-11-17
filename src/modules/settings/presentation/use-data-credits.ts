import { useDependency } from '@core/presentation';
import { ExerciseDataCreditsToken } from '@modules/exercises';

export interface DataCreditsTexts {
  /** "Exercise data and images: free-exercise-db" */
  readonly attribution: string;
  readonly repositoryUrl: string;
  /** "Licence: The Unlicense (public domain)" */
  readonly licence: string;
  readonly licenceUrl: string;
}

/**
 * View-model hook (MVVM) of Settings → Credits (S1-24). The dataset name, link and licence come
 * from `ExerciseDataCredits`, registered once from the seed manifest, so Settings holds no copy.
 * The value is constant per process, so it needs no loading or error state.
 */
export function useDataCredits(): DataCreditsTexts {
  const credits = useDependency(ExerciseDataCreditsToken);
  return {
    attribution: `Exercise data and images: ${credits.datasetName}`,
    repositoryUrl: credits.repositoryUrl,
    licence: `Licence: ${credits.licenceName}`,
    licenceUrl: credits.licenceUrl,
  };
}
