import { usePreventRemove, useRouter } from 'expo-router';
import { useEffect, useState, type ReactElement } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Button, Chip, Dialog, ErrorState, Subheading, TextField, useTheme } from '@shared/ui';

import type { ExerciseId } from '@shared/domain/ids';
import { map } from '@shared/domain/result';

import { TRACKED_METRICS } from '../domain/tracked-metric';

import { TRACKED_METRIC_LABELS } from './exercise-labels';
import { exerciseRoutes } from './exercise-routes';
import type { MultiValueField, SingleValueField } from './exercise-form-fields';
import { PhotoField } from './photo-field';
import { PickerField } from './picker-field';
import { useBackToLibrary } from './use-back-to-library';
import { useExerciseEditor, type ExerciseEditor, type SaveSubmitter } from './use-exercise-editor';
import type { FormData, FormSubmit } from './use-exercise-form';

const PICKERS: readonly {
  readonly field: SingleValueField | MultiValueField;
  readonly label: string;
  readonly noun: string;
}[] = [
  { field: 'category', label: 'Category', noun: 'category' },
  { field: 'primaryMuscles', label: 'Primary muscles', noun: 'muscle' },
  { field: 'secondaryMuscles', label: 'Secondary muscles', noun: 'muscle' },
  { field: 'equipment', label: 'Equipment', noun: 'equipment' },
];

/** Create answers the new id (its detail opens instead of the form); edit answers `null` (go back). */
function savedExerciseOf(submit: FormSubmit): SaveSubmitter<ExerciseId | null> {
  return submit.kind === 'create'
    ? submit.run
    : async (input) => map(await submit.run(input), () => null);
}

function isSingle(field: SingleValueField | MultiValueField): field is SingleValueField {
  return field === 'category' || field === 'equipment';
}

function VocabularyPickers({
  editor,
}: {
  readonly editor: ExerciseEditor<ExerciseId | null>;
}): ReactElement {
  return (
    <>
      {PICKERS.map(({ field, label, noun }) => {
        const value = editor.fields[field];
        const chosen = value === null ? [] : Array.isArray(value) ? value : [value];
        return (
          <PickerField
            key={field}
            label={label}
            noun={noun}
            options={editor.optionsFor(field)}
            chosen={chosen.map((item) => item.option)}
            onToggle={(option) =>
              isSingle(field) ? editor.selectOne(field, option) : editor.toggleMany(field, option)
            }
            onAddOwn={(text) => editor.addOwnValue(field, text)}
            error={editor.errors[field]}
          />
        );
      })}
    </>
  );
}

function MetricField({
  editor,
}: {
  readonly editor: ExerciseEditor<ExerciseId | null>;
}): ReactElement {
  const { colors, spacing, typography } = useTheme();
  const error = editor.errors.trackedMetrics;
  return (
    <View style={{ gap: spacing.small }}>
      <Subheading>Tracked metrics</Subheading>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.small }}>
        {TRACKED_METRICS.map((metric) => (
          <Chip
            key={metric}
            label={TRACKED_METRIC_LABELS[metric]}
            selected={editor.fields.trackedMetrics.includes(metric)}
            onPress={() => editor.toggleMetric(metric)}
          />
        ))}
      </View>
      {error === undefined ? null : (
        <Text style={{ color: colors.danger, fontSize: typography.captionSize }}>{error}</Text>
      )}
    </View>
  );
}

/**
 * The custom-exercise form once its values are loaded (S1-19, S1-20, S1-22, S1-23, S1-29). Save
 * opens the new exercise (create) or returns (edit). Leaving with unsaved changes — Cancel, the
 * header back action or Android's back button — asks "Discard changes?" first.
 */
export function ExerciseFormEditor({ data }: { readonly data: FormData }): ReactElement {
  const { spacing } = useTheme();
  const router = useRouter();
  const backToLibrary = useBackToLibrary();
  const editor = useExerciseEditor<ExerciseId | null>({
    initial: data.values,
    options: data.options,
    submit: savedExerciseOf(data.submit),
  });
  const [blockedLeave, setBlockedLeave] = useState<(() => void) | null>(null);
  /** Set once saved or discarded: leave as soon as the unsaved-changes guard is off. */
  const [exit, setExit] = useState<(() => void) | null>(null);
  usePreventRemove(editor.isDirty && exit === null, ({ repeat }) => setBlockedLeave(() => repeat));
  useEffect(() => {
    exit?.();
  }, [exit]);

  const save = async () => {
    const outcome = await editor.save();
    if (!outcome.saved) {
      return;
    }
    const savedId = outcome.value;
    setExit(() =>
      savedId === null ? backToLibrary : () => router.replace(exerciseRoutes.detail(savedId)),
    );
  };

  const discard = async () => {
    const leave = blockedLeave;
    setBlockedLeave(null);
    await editor.discard();
    setExit(() => leave ?? backToLibrary);
  };

  const { fields, errors } = editor;
  return (
    <>
      <ScrollView
        contentContainerStyle={{ gap: spacing.medium }}
        keyboardShouldPersistTaps="handled"
      >
        <TextField
          label="Name"
          value={fields.name}
          onChangeText={editor.setName}
          {...(errors.name === undefined ? {} : { error: errors.name })}
        />
        <VocabularyPickers editor={editor} />
        <TextField
          label="Instructions"
          multiline
          placeholder="One step per line"
          value={fields.instructionsText}
          onChangeText={editor.setInstructionsText}
          {...(errors.instructions === undefined ? {} : { error: errors.instructions })}
        />
        <PhotoField
          photos={fields.photos}
          canAdd={editor.canAddPhoto}
          onAdd={(source) => void editor.addPhoto(source)}
          onRemove={editor.removePhoto}
          photoError={editor.photoError}
          error={errors.photos}
        />
        <MetricField editor={editor} />
        {editor.formError === undefined ? null : (
          <ErrorState title="Could not save the exercise" message={editor.formError} />
        )}
      </ScrollView>
      <Button label="Save" disabled={editor.isSaving} onPress={() => void save()} />
      <Button label="Cancel" variant="secondary" onPress={backToLibrary} />
      <Dialog
        visible={blockedLeave !== null}
        title="Discard changes?"
        message="Your changes to this exercise are not saved."
        actions={[
          { label: 'Discard', variant: 'destructive', onPress: () => void discard() },
          { label: 'Keep editing', variant: 'secondary', onPress: () => setBlockedLeave(null) },
        ]}
        onDismiss={() => setBlockedLeave(null)}
      />
    </>
  );
}
