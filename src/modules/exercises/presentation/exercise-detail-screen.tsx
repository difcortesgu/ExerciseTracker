import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactElement } from 'react';
import { ScrollView, View } from 'react-native';

import {
  BodyText,
  Button,
  Dialog,
  ErrorState,
  LoadingState,
  Screen,
  Subheading,
  useTheme,
} from '@shared/ui';

import type { ExerciseDetails, VocabularyOption } from '../application/exercise-dtos';

import { DetailFact } from './detail-fact';
import { exerciseErrorMessage } from './exercise-error-texts';
import { FORCE_LABELS, LEVEL_LABELS, MECHANIC_LABELS, trackedMetricsText } from './exercise-labels';
import { ExerciseNotFound } from './exercise-not-found';
import { exerciseRoutes } from './exercise-routes';
import { ImageGallery } from './image-gallery';
import { useBackToLibrary } from './use-back-to-library';
import { useExerciseDetails, type ExerciseDetailsViewModel } from './use-exercise-details';
import { useRefreshOnReturn } from './use-refresh-on-return';

const HEADER_TITLE = 'Exercise';
const NOT_SPECIFIED = 'Not specified';

const labels = (options: readonly VocabularyOption[]) =>
  options.map((option) => option.label).join(', ');

function ExerciseFacts({ details }: { readonly details: ExerciseDetails }): ReactElement {
  const { builtIn } = details;
  return (
    <>
      <DetailFact label="Category" value={details.category.label} />
      <DetailFact label="Equipment" value={details.equipment?.label ?? NOT_SPECIFIED} />
      <DetailFact label="Primary muscles" value={labels(details.primaryMuscles)} />
      {details.secondaryMuscles.length > 0 ? (
        <DetailFact label="Secondary muscles" value={labels(details.secondaryMuscles)} />
      ) : null}
      <DetailFact label="Tracked metrics" value={trackedMetricsText(details.trackedMetrics)} />
      {builtIn === null ? null : (
        <>
          <DetailFact label="Level" value={LEVEL_LABELS[builtIn.level]} />
          {builtIn.force === null ? null : (
            <DetailFact label="Force" value={FORCE_LABELS[builtIn.force]} />
          )}
          {builtIn.mechanic === null ? null : (
            <DetailFact label="Mechanic" value={MECHANIC_LABELS[builtIn.mechanic]} />
          )}
        </>
      )}
    </>
  );
}

function Instructions({ steps }: { readonly steps: readonly string[] }): ReactElement {
  return (
    <>
      <Subheading>Instructions</Subheading>
      {steps.length === 0 ? (
        <BodyText tone="textMuted">No instructions</BodyText>
      ) : (
        steps.map((step, index) => <BodyText key={index}>{`${index + 1}. ${step}`}</BodyText>)
      )}
    </>
  );
}

interface DetailActionsProps {
  readonly details: ExerciseDetails;
  readonly viewModel: ExerciseDetailsViewModel;
}

/**
 * Built-ins are read-only: Duplicate as custom only (decision Q2). Custom: Edit and Delete with a
 * confirmation (S1-21). Kept at the bottom, in thumb reach.
 */
function DetailActions({ details, viewModel }: DetailActionsProps): ReactElement {
  const router = useRouter();
  const backToLibrary = useBackToLibrary();
  const { spacing } = useTheme();
  const [isConfirming, setIsConfirming] = useState(false);

  if (!details.isCustom) {
    return (
      <Button
        label="Duplicate as custom"
        onPress={() => router.push(exerciseRoutes.duplicate(details.id))}
      />
    );
  }

  const confirmDelete = async () => {
    setIsConfirming(false);
    if (await viewModel.deleteExercise()) {
      backToLibrary();
    }
  };
  const { deletion } = viewModel;

  return (
    <View style={{ gap: spacing.small }}>
      {deletion.status === 'failed' ? (
        <ErrorState
          title="Could not delete the exercise"
          message={exerciseErrorMessage(deletion.error)}
        />
      ) : null}
      <Button label="Edit" onPress={() => router.push(exerciseRoutes.edit(details.id))} />
      <Button
        label="Delete"
        variant="destructive"
        disabled={deletion.status === 'deleting'}
        onPress={() => setIsConfirming(true)}
      />
      <Dialog
        visible={isConfirming}
        title={`Delete '${details.name}'?`}
        message="It disappears from your library and its photos are deleted. This cannot be undone."
        actions={[
          { label: 'Delete', variant: 'destructive', onPress: () => void confirmDelete() },
          { label: 'Cancel', variant: 'secondary', onPress: () => setIsConfirming(false) },
        ]}
        onDismiss={() => setIsConfirming(false)}
      />
    </View>
  );
}

function LoadedDetail({ details, viewModel }: DetailActionsProps): ReactElement {
  const { spacing } = useTheme();
  return (
    <Screen title={details.name}>
      <ScrollView contentContainerStyle={{ gap: spacing.medium }}>
        <ImageGallery
          exerciseName={details.name}
          images={details.images}
          offerOfflineDownload={!details.isCustom}
        />
        <ExerciseFacts details={details} />
        <Instructions steps={details.instructions} />
      </ScrollView>
      <DetailActions details={details} viewModel={viewModel} />
    </Screen>
  );
}

/**
 * Exercise detail (S1-17), a stack screen above the tabs (`app/exercises/[id]/index.tsx`):
 * details, swipeable images, numbered instructions and the actions allowed for its origin.
 * Refreshes when shown again after editing.
 */
export function ExerciseDetailScreen(): ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const viewModel = useExerciseDetails(id);
  useRefreshOnReturn(viewModel.reload);
  const { details } = viewModel;

  return (
    <>
      <Stack.Screen options={{ title: HEADER_TITLE }} />
      {details.status === 'loading' ? (
        <Screen>
          <LoadingState label="Loading exercise" />
        </Screen>
      ) : null}
      {details.status === 'failed' && details.error.code === 'exercises.notFound' ? (
        <ExerciseNotFound />
      ) : null}
      {details.status === 'failed' && details.error.code !== 'exercises.notFound' ? (
        <Screen>
          <ErrorState
            title="Could not load the exercise"
            message={exerciseErrorMessage(details.error)}
            onRetry={viewModel.reload}
          />
        </Screen>
      ) : null}
      {details.status === 'loaded' ? (
        <LoadedDetail details={details.value} viewModel={viewModel} />
      ) : null}
    </>
  );
}
