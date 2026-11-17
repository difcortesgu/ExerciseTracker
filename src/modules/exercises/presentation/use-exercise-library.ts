import { useCallback, useMemo, useState } from 'react';

import { useDependency } from '@core/presentation';

import type { VocabularyKey, VocabularyKind } from '../domain/vocabulary';
import type {
  ExerciseListItem,
  ExerciseSearchQuery,
  VocabularyOptions,
} from '../application/exercise-dtos';
import { FindExercisesToken } from '../application/find-exercises';
import type { ExerciseLibraryError } from '../application/library-errors';
import { ListVocabularyOptionsToken } from '../application/list-vocabulary-options';

import { useDebouncedValue } from './use-debounced-value';
import { useResultLoader, type LoadState } from './use-result-loader';

/** Typing pause before searching; with the in-memory search this keeps results under 300 ms. */
export const SEARCH_DEBOUNCE_MS = 250;

/** The filter controls, in display order (S1-16: Muscle, Equipment, Category). */
export const FILTER_KINDS: readonly VocabularyKind[] = ['muscle', 'equipment', 'category'];

type FacetField = keyof Omit<ExerciseSearchQuery, 'text'>;

/** Which query facet each vocabulary filters (the matching itself is the domain's, S1-09). */
const FACET_OF: Readonly<Record<VocabularyKind, FacetField>> = {
  muscle: 'muscles',
  equipment: 'equipment',
  category: 'categories',
};

type Filters = Readonly<Record<FacetField, readonly VocabularyKey[]>>;

const NO_FILTERS: Filters = Object.freeze({ muscles: [], equipment: [], categories: [] });

export interface ActiveFilter {
  readonly kind: VocabularyKind;
  readonly key: VocabularyKey;
  readonly label: string;
}

export interface ExerciseLibrary {
  /** The search field's text (shown at once; searched after a short pause). */
  readonly text: string;
  readonly setText: (text: string) => void;
  readonly list: LoadState<readonly ExerciseListItem[], ExerciseLibraryError>;
  readonly options: LoadState<VocabularyOptions, ExerciseLibraryError>;
  readonly selectedKeys: (kind: VocabularyKind) => readonly VocabularyKey[];
  readonly toggleFilter: (kind: VocabularyKind, key: VocabularyKey) => void;
  readonly activeFilters: readonly ActiveFilter[];
  readonly hasActiveFilters: boolean;
  /** Resets every filter, not the search text (S1-16). */
  readonly clearFilters: () => void;
  /** Retry after a failure, or refresh when the tab is shown again. */
  readonly reload: () => void;
}

function toggled(keys: readonly VocabularyKey[], key: VocabularyKey): readonly VocabularyKey[] {
  return keys.includes(key) ? keys.filter((selected) => selected !== key) : [...keys, key];
}

function labelOf(
  options: LoadState<VocabularyOptions, ExerciseLibraryError>,
  kind: VocabularyKind,
  key: VocabularyKey,
): string {
  const found =
    options.status === 'loaded'
      ? options.value[kind].find((option) => option.key === key)
      : undefined;
  return found?.label ?? key;
}

/**
 * View-model hook (MVVM) of the library screen (S1-16): holds the search text and filters, asks
 * `FindExercises` for the matching list (never matching anything itself) and
 * `ListVocabularyOptions` for the filter values, built-in and user-defined together (S1-29).
 */
export function useExerciseLibrary(): ExerciseLibrary {
  const findExercises = useDependency(FindExercisesToken);
  const listVocabularyOptions = useDependency(ListVocabularyOptionsToken);
  const [text, setText] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const searchedText = useDebouncedValue(text, SEARCH_DEBOUNCE_MS);

  const query = useMemo<ExerciseSearchQuery>(
    () => ({ text: searchedText, ...filters }),
    [searchedText, filters],
  );
  const list = useResultLoader(useCallback(() => findExercises(query), [findExercises, query]));
  const options = useResultLoader(listVocabularyOptions);

  const toggleFilter = useCallback((kind: VocabularyKind, key: VocabularyKey) => {
    const field = FACET_OF[kind];
    setFilters((current) => ({ ...current, [field]: toggled(current[field], key) }));
  }, []);
  const clearFilters = useCallback(() => setFilters(NO_FILTERS), []);
  const { reload: reloadList } = list;
  const { reload: reloadOptions } = options;
  const reload = useCallback(() => {
    reloadList();
    reloadOptions();
  }, [reloadList, reloadOptions]);

  const activeFilters = FILTER_KINDS.flatMap((kind) =>
    filters[FACET_OF[kind]].map((key) => ({ kind, key, label: labelOf(options.state, kind, key) })),
  );

  return {
    text,
    setText,
    list: list.state,
    options: options.state,
    selectedKeys: (kind) => filters[FACET_OF[kind]],
    toggleFilter,
    activeFilters,
    hasActiveFilters: activeFilters.length > 0,
    clearFilters,
    reload,
  };
}
