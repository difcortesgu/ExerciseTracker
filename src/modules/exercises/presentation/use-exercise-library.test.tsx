import { act, renderHook } from '@testing-library/react-native';

import { err, ok } from '@shared/domain/result';
import { vocabularyKeyOf } from '@test/builders/exercise.builder';
import {
  exerciseContainer,
  libraryItems,
  storageFailed,
  vocabularyOptions,
  withContainer,
} from '@test/support/exercise-screen-harness';

import type { ExerciseSearchQuery } from '../application/exercise-dtos';
import type { FindExercises } from '../application/find-exercises';

import { SEARCH_DEBOUNCE_MS, useExerciseLibrary } from './use-exercise-library';

const EMPTY_QUERY: ExerciseSearchQuery = { text: '', muscles: [], equipment: [], categories: [] };

function recordingFind() {
  const queries: ExerciseSearchQuery[] = [];
  const findExercises: FindExercises = (query) => {
    queries.push(query);
    return Promise.resolve(ok(libraryItems));
  };
  return { findExercises, queries, last: () => queries.at(-1) };
}

async function renderLibrary(findExercises: FindExercises) {
  return renderHook(() => useExerciseLibrary(), {
    wrapper: withContainer(exerciseContainer({ findExercises })),
  });
}

describe('useExerciseLibrary (S1-16)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('loads the whole library with an empty query', async () => {
    const find = recordingFind();

    const { result } = await renderLibrary(find.findExercises);

    expect(find.queries).toEqual([EMPTY_QUERY]);
    expect(result.current.list).toEqual({ status: 'loaded', value: libraryItems });
  });

  it('searches with the typed text once typing pauses, not on every keystroke', async () => {
    const find = recordingFind();
    const { result } = await renderLibrary(find.findExercises);

    await act(async () => result.current.setText('s'));
    await act(async () => result.current.setText('sq'));
    await act(async () => result.current.setText('squat'));
    expect(result.current.text).toBe('squat');
    expect(find.queries).toHaveLength(1);

    await act(async () => jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS));

    expect(find.queries).toHaveLength(2);
    expect(find.last()).toEqual({ ...EMPTY_QUERY, text: 'squat' });
    expect(SEARCH_DEBOUNCE_MS).toBeLessThanOrEqual(250);
  });

  it('combines filters of every kind with the search text', async () => {
    const find = recordingFind();
    const { result } = await renderLibrary(find.findExercises);

    await act(async () => result.current.setText('squat'));
    await act(async () => jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    await act(async () => result.current.toggleFilter('muscle', vocabularyKeyOf('Quadriceps')));
    await act(async () => result.current.toggleFilter('muscle', vocabularyKeyOf('Glutes')));
    await act(async () => result.current.toggleFilter('equipment', vocabularyKeyOf('Sandbag')));
    await act(async () => result.current.toggleFilter('category', vocabularyKeyOf('Strength')));

    expect(find.last()).toEqual({
      text: 'squat',
      muscles: [vocabularyKeyOf('Quadriceps'), vocabularyKeyOf('Glutes')],
      equipment: [vocabularyKeyOf('Sandbag')],
      categories: [vocabularyKeyOf('Strength')],
    });
  });

  it('removes a filter value when it is toggled again', async () => {
    const find = recordingFind();
    const { result } = await renderLibrary(find.findExercises);

    await act(async () => result.current.toggleFilter('muscle', vocabularyKeyOf('Quadriceps')));
    await act(async () => result.current.toggleFilter('muscle', vocabularyKeyOf('Quadriceps')));

    expect(find.last()).toEqual(EMPTY_QUERY);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('lists the active filters with their labels, built-in and your own alike', async () => {
    const { result } = await renderLibrary(recordingFind().findExercises);

    await act(async () => result.current.toggleFilter('equipment', vocabularyKeyOf('Sandbag')));
    await act(async () => result.current.toggleFilter('muscle', vocabularyKeyOf('Quadriceps')));

    expect(result.current.activeFilters).toEqual([
      { kind: 'muscle', key: vocabularyKeyOf('Quadriceps'), label: 'Quadriceps' },
      { kind: 'equipment', key: vocabularyKeyOf('Sandbag'), label: 'Sandbag' },
    ]);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('clears every filter but keeps the search text', async () => {
    const find = recordingFind();
    const { result } = await renderLibrary(find.findExercises);
    await act(async () => result.current.setText('squat'));
    await act(async () => jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    await act(async () => result.current.toggleFilter('category', vocabularyKeyOf('Strength')));

    await act(async () => result.current.clearFilters());

    expect(find.last()).toEqual({ ...EMPTY_QUERY, text: 'squat' });
    expect(result.current.text).toBe('squat');
    expect(result.current.activeFilters).toEqual([]);
  });

  it('offers the filter values from the vocabulary use case', async () => {
    const { result } = await renderLibrary(recordingFind().findExercises);

    expect(result.current.options).toEqual({ status: 'loaded', value: vocabularyOptions });
  });

  it('reports a failure and loads again on retry', async () => {
    let calls = 0;
    const findExercises: FindExercises = () => {
      calls += 1;
      return Promise.resolve(calls === 1 ? err(storageFailed) : ok(libraryItems));
    };
    const { result } = await renderLibrary(findExercises);
    expect(result.current.list).toEqual({ status: 'failed', error: storageFailed });

    await act(async () => result.current.reload());

    expect(result.current.list).toEqual({ status: 'loaded', value: libraryItems });
  });

  it('shows an active filter by its key until the filter values have loaded', async () => {
    const { result } = await renderHook(() => useExerciseLibrary(), {
      wrapper: withContainer(
        exerciseContainer({
          findExercises: recordingFind().findExercises,
          listVocabularyOptions: () => new Promise(() => undefined),
        }),
      ),
    });

    await act(async () => result.current.toggleFilter('muscle', vocabularyKeyOf('Quadriceps')));

    expect(result.current.options).toEqual({ status: 'loading' });
    expect(result.current.activeFilters).toEqual([
      { kind: 'muscle', key: vocabularyKeyOf('Quadriceps'), label: 'quadriceps' },
    ]);
  });
});
