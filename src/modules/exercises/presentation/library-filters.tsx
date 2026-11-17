import { useState, type ReactElement } from 'react';
import { View } from 'react-native';

import { Button, Chip, useTheme } from '@shared/ui';

import type { VocabularyKind } from '../domain/vocabulary';
import type { VocabularyOptions } from '../application/exercise-dtos';

import { OptionPicker } from './option-picker';
import { FILTER_KINDS, type ExerciseLibrary } from './use-exercise-library';

export const CLEAR_FILTERS_LABEL = 'Clear filters';

const FILTER_TITLES: Readonly<Record<VocabularyKind, string>> = {
  muscle: 'Muscle',
  equipment: 'Equipment',
  category: 'Category',
};

const NO_OPTIONS: VocabularyOptions = { category: [], muscle: [], equipment: [] };

export interface LibraryFiltersProps {
  readonly library: ExerciseLibrary;
}

/**
 * Filter controls of the library (S1-16): Muscle, Equipment and Category pickers with the number
 * of chosen values, the active filters as chips (tap to remove) and Clear filters.
 */
export function LibraryFilters({ library }: LibraryFiltersProps): ReactElement {
  const { spacing } = useTheme();
  const [openKind, setOpenKind] = useState<VocabularyKind | null>(null);
  const options = library.options.status === 'loaded' ? library.options.value : NO_OPTIONS;

  const buttonLabel = (kind: VocabularyKind) => {
    const count = library.selectedKeys(kind).length;
    return count === 0 ? FILTER_TITLES[kind] : `${FILTER_TITLES[kind]} (${count})`;
  };

  return (
    <View style={{ gap: spacing.small }}>
      <View style={{ flexDirection: 'row', gap: spacing.small }}>
        {FILTER_KINDS.map((kind) => (
          <View key={kind} style={{ flex: 1 }}>
            <Button
              label={buttonLabel(kind)}
              variant="secondary"
              onPress={() => setOpenKind(kind)}
            />
          </View>
        ))}
      </View>
      {library.hasActiveFilters ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.small }}>
          {library.activeFilters.map((filter) => (
            <Chip
              key={`${filter.kind}:${filter.key}`}
              label={filter.label}
              selected
              onPress={() => library.toggleFilter(filter.kind, filter.key)}
            />
          ))}
          <Button label={CLEAR_FILTERS_LABEL} variant="secondary" onPress={library.clearFilters} />
        </View>
      ) : null}
      {openKind === null ? null : (
        <OptionPicker
          visible
          title={FILTER_TITLES[openKind]}
          options={options[openKind]}
          selectedKeys={library.selectedKeys(openKind)}
          onToggle={(option) => library.toggleFilter(openKind, option.key)}
          onClose={() => setOpenKind(null)}
        />
      )}
    </View>
  );
}
