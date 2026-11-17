import { useRouter } from 'expo-router';
import { useCallback, useState, type ReactElement } from 'react';
import { FlatList, View } from 'react-native';

import {
  BodyText,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  TextField,
  useTheme,
} from '@shared/ui';

import type { ExerciseListItem } from '../application/exercise-dtos';

import { DownloadImagesLink } from './download-images-link';
import { exerciseErrorMessage } from './exercise-error-texts';
import { ExerciseRow } from './exercise-row';
import { exerciseRoutes } from './exercise-routes';
import { CLEAR_FILTERS_LABEL, LibraryFilters } from './library-filters';
import { resultCountText } from './library-texts';
import { useExerciseLibrary, type ExerciseLibrary } from './use-exercise-library';
import { useRefreshOnReturn } from './use-refresh-on-return';

/** Rows rendered before the first scroll, and per batch while scrolling. */
const ROWS_PER_BATCH = 12;
/** Screens' worth of rows kept mounted around the visible ones (virtualisation window). */
const WINDOW_SCREENS = 5;
/**
 * Upper bound of rows mounted at once: the list is virtualised, so ~900 exercises never mount
 * ~900 rows (S1-16; asserted by the screen test).
 */
export const MAX_MOUNTED_ROWS = 60;

const LOADING_LABEL = 'Loading exercises';
const LOAD_FAILED_TITLE = 'Could not load exercises';
const NO_MATCH_MESSAGE = 'No exercises match';

const keyOf = (item: ExerciseListItem) => item.id;

interface LibraryContentProps {
  readonly library: ExerciseLibrary;
  readonly onOpen: (item: ExerciseListItem) => void;
}

/** Loading, error, empty or the virtualised list (S1-16, S1-13 seeding states). */
function LibraryContent({ library, onOpen }: LibraryContentProps): ReactElement {
  const { list } = library;
  const [hasUnavailableImage, setHasUnavailableImage] = useState(false);
  const reportUnavailable = useCallback(() => setHasUnavailableImage(true), []);
  switch (list.status) {
    case 'loading':
      return <LoadingState label={LOADING_LABEL} />;
    case 'failed':
      return (
        <ErrorState
          title={LOAD_FAILED_TITLE}
          message={exerciseErrorMessage(list.error)}
          onRetry={library.reload}
        />
      );
    case 'loaded':
      return list.value.length === 0 ? (
        <EmptyState
          message={NO_MATCH_MESSAGE}
          {...(library.hasActiveFilters
            ? { action: { label: CLEAR_FILTERS_LABEL, onPress: library.clearFilters } }
            : {})}
        />
      ) : (
        <View style={{ flex: 1 }}>
          <BodyText tone="textMuted">{resultCountText(list.value.length)}</BodyText>
          {hasUnavailableImage ? <DownloadImagesLink /> : null}
          <FlatList
            data={list.value}
            keyExtractor={keyOf}
            renderItem={({ item }) => (
              <ExerciseRow
                item={item}
                onOpen={onOpen}
                onBuiltInImageUnavailable={reportUnavailable}
              />
            )}
            initialNumToRender={ROWS_PER_BATCH}
            maxToRenderPerBatch={ROWS_PER_BATCH}
            windowSize={WINDOW_SCREENS}
            removeClippedSubviews
            keyboardShouldPersistTaps="handled"
          />
        </View>
      );
  }
}

/**
 * Exercises tab: the exercise library (S1-16). Search while typing, combinable filters, the
 * virtualised list, and Add exercise in thumb reach. It stays mounted under the stack, so search,
 * filters and scroll position survive the detail and the form; the list refreshes on return.
 */
export function ExercisesScreen(): ReactElement {
  const library = useExerciseLibrary();
  const router = useRouter();
  const { spacing } = useTheme();
  useRefreshOnReturn(library.reload);

  const openExercise = useCallback(
    (item: ExerciseListItem) => router.push(exerciseRoutes.detail(item.id)),
    [router],
  );

  return (
    <Screen title="Exercises">
      <View style={{ gap: spacing.small }}>
        <TextField
          label="Search exercises"
          hideLabel
          placeholder="Search exercises"
          value={library.text}
          onChangeText={library.setText}
        />
        <LibraryFilters library={library} />
      </View>
      <LibraryContent library={library} onOpen={openExercise} />
      <Button label="Add exercise" onPress={() => router.push(exerciseRoutes.create())} />
    </Screen>
  );
}
