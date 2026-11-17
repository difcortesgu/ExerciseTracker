import { Stack, useLocalSearchParams } from 'expo-router';
import type { ReactElement } from 'react';

import { ErrorState, LoadingState, Screen } from '@shared/ui';

import { exerciseErrorMessage } from './exercise-error-texts';
import { ExerciseFormEditor } from './exercise-form-editor';
import { ExerciseNotFound } from './exercise-not-found';
import { useExerciseForm, type FormMode } from './use-exercise-form';

const TITLES: Readonly<Record<FormMode['kind'], string>> = {
  create: 'New exercise',
  duplicate: 'New exercise',
  edit: 'Edit exercise',
};

function FormContent({ mode }: { readonly mode: FormMode }): ReactElement {
  const { data, reload } = useExerciseForm(mode);
  switch (data.status) {
    case 'loading':
      return (
        <Screen>
          <LoadingState label="Loading form" />
        </Screen>
      );
    case 'failed':
      return data.error.code === 'exercises.notFound' ? (
        <ExerciseNotFound />
      ) : (
        <Screen>
          <ErrorState
            title="Could not open the form"
            message={exerciseErrorMessage(data.error)}
            onRetry={reload}
          />
        </Screen>
      );
    case 'loaded':
      return (
        <Screen>
          <ExerciseFormEditor data={data.value} />
        </Screen>
      );
  }
}

/** The custom-exercise form as a stack screen with its header title (S1-19, S1-20, S1-23). */
export function ExerciseFormScreen({ mode }: { readonly mode: FormMode }): ReactElement {
  return (
    <>
      <Stack.Screen options={{ title: TITLES[mode.kind] }} />
      <FormContent mode={mode} />
    </>
  );
}

/** `app/exercises/new.tsx`: blank, or prefilled from a built-in with `?duplicateOf=<id>` (S1-23). */
export function NewExerciseScreen(): ReactElement {
  const { duplicateOf } = useLocalSearchParams<{ duplicateOf?: string }>();
  return (
    <ExerciseFormScreen
      mode={
        duplicateOf === undefined
          ? { kind: 'create' }
          : { kind: 'duplicate', sourceId: duplicateOf }
      }
    />
  );
}

/** `app/exercises/[id]/edit.tsx` (S1-20). */
export function EditExerciseScreen(): ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ExerciseFormScreen mode={{ kind: 'edit', id }} />;
}
