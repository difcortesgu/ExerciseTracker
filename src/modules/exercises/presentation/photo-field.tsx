import { Image } from 'expo-image';
import { useState, type ReactElement } from 'react';
import { Text, View } from 'react-native';

import { BodyText, Button, Dialog, Subheading, useTheme } from '@shared/ui';

import type { PhotoFileName } from '../domain/exercise';
import { EXERCISE_LIMITS } from '../domain/exercise-draft';
import type { PhotoView } from '../application/exercise-dtos';
import type { PhotoSource } from '../application/photo-ports';

const PHOTO_SIZE = 96;

export interface PhotoFieldProps {
  readonly photos: readonly PhotoView[];
  readonly canAdd: boolean;
  readonly onAdd: (source: PhotoSource) => void;
  readonly onRemove: (fileName: PhotoFileName) => void;
  /** Why the last photo could not be added (permission, storage). */
  readonly photoError: string | undefined;
  /** A field issue from the domain (e.g. too many photos). */
  readonly error: string | undefined;
}

/**
 * Photos of a custom exercise (S1-22): app-owned copies with Remove, and Add photo with a choice
 * of Camera or Gallery; disabled at the domain's maximum, with the hint "Up to 6 photos".
 */
export function PhotoField({
  photos,
  canAdd,
  onAdd,
  onRemove,
  photoError,
  error,
}: PhotoFieldProps): ReactElement {
  const { colors, spacing, typography, shape } = useTheme();
  const [isChoosing, setIsChoosing] = useState(false);
  const choose = (source: PhotoSource) => {
    setIsChoosing(false);
    onAdd(source);
  };
  const problems = [error, photoError].filter((text): text is string => text !== undefined);

  return (
    <View style={{ gap: spacing.small }}>
      <Subheading>Photos</Subheading>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.small }}>
        {photos.map((photo, index) => (
          <View key={photo.fileName} style={{ gap: spacing.small }}>
            <Image
              source={{ uri: photo.uri }}
              cachePolicy="memory"
              accessibilityLabel={`Photo ${index + 1} of ${photos.length}`}
              style={{ width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: shape.cornerRadius }}
            />
            <Button
              label={`Remove photo ${index + 1}`}
              variant="secondary"
              onPress={() => onRemove(photo.fileName)}
            />
          </View>
        ))}
      </View>
      <Button
        label="Add photo"
        variant="secondary"
        disabled={!canAdd}
        onPress={() => setIsChoosing(true)}
      />
      <BodyText tone="textMuted">{`Up to ${EXERCISE_LIMITS.photosMax} photos`}</BodyText>
      {problems.map((problem) => (
        <Text key={problem} style={{ color: colors.danger, fontSize: typography.captionSize }}>
          {problem}
        </Text>
      ))}
      <Dialog
        visible={isChoosing}
        title="Add photo"
        actions={[
          { label: 'Camera', onPress: () => choose('camera') },
          { label: 'Gallery', onPress: () => choose('library') },
          { label: 'Cancel', variant: 'secondary', onPress: () => setIsChoosing(false) },
        ]}
        onDismiss={() => setIsChoosing(false)}
      />
    </View>
  );
}
