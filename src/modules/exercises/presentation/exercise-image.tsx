import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect, type ReactElement } from 'react';
import { View, type ImageStyle } from 'react-native';

import { BodyText, useTheme } from '@shared/ui';

import type { ExerciseImageRef } from '../application/exercise-dtos';

import { useExerciseImage } from './use-exercise-image';

export const IMAGE_UNAVAILABLE_LABEL = 'Image not available offline';
export const NO_IMAGE_LABEL = 'No image';

const THUMBNAIL_SIZE = 64;
const GALLERY_ASPECT_RATIO = 4 / 3;
const THUMBNAIL_ICON_SIZE = 28;
const GALLERY_ICON_SIZE = 48;

/** `thumbnail`: a list row's square cover. `gallery`: full width on the detail screen. */
export type ExerciseImageVariant = 'thumbnail' | 'gallery';

// `ImageStyle` (not `ViewStyle`): the same frame styles the expo-image `Image` (which refuses
// `overflow: 'scroll'`) and the placeholder `View`s, so every state has the same size.
const VARIANT_STYLES: Readonly<Record<ExerciseImageVariant, ImageStyle>> = {
  thumbnail: { width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE },
  gallery: { width: '100%', aspectRatio: GALLERY_ASPECT_RATIO },
};

const ICON_SIZES: Readonly<Record<ExerciseImageVariant, number>> = {
  thumbnail: THUMBNAIL_ICON_SIZE,
  gallery: GALLERY_ICON_SIZE,
};

export interface ExerciseImageProps {
  /** `null`: the exercise has no image (neutral placeholder, nothing is fetched). */
  readonly image: ExerciseImageRef | null;
  /** Accessibility label of the image, e.g. "Barbell Squat, image 1 of 2". */
  readonly label: string;
  readonly variant: ExerciseImageVariant;
  /** Called when the image cannot be shown (e.g. so the gallery can link to the bulk download). */
  readonly onUnavailable?: () => void;
}

/**
 * One exercise image or photo (S1-17, S1-18, S1-22). Shows the local `file://` URI from
 * `GetExerciseImage` with `expo-image` (memory cache only: the persistent cache is the app's own
 * folder, ADR-004), a busy placeholder while fetching, and "Image not available offline" when it
 * cannot be shown (the rest of the screen keeps working; the next view retries).
 */
export function ExerciseImage({
  image,
  label,
  variant,
  onUnavailable,
}: ExerciseImageProps): ReactElement {
  const state = useExerciseImage(image);
  const isUnavailable = state.status === 'unavailable';
  useEffect(() => {
    if (isUnavailable) {
      onUnavailable?.();
    }
  }, [isUnavailable, onUnavailable]);
  const { colors, shape } = useTheme();
  const frame: ImageStyle = {
    ...VARIANT_STYLES[variant],
    borderRadius: shape.cornerRadius,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const icon = (name: 'image-outline' | 'cloud-offline-outline') => (
    <Ionicons name={name} size={ICON_SIZES[variant]} color={colors.textMuted} />
  );

  switch (state.status) {
    case 'available':
      return (
        <Image
          source={{ uri: state.uri }}
          cachePolicy="memory"
          contentFit="cover"
          accessibilityLabel={label}
          style={frame}
        />
      );
    case 'loading':
      return <View accessibilityLabel={label} accessibilityState={{ busy: true }} style={frame} />;
    case 'none':
      return (
        <View accessible accessibilityLabel={NO_IMAGE_LABEL} style={frame}>
          {icon('image-outline')}
        </View>
      );
    case 'unavailable':
      return (
        <View accessible accessibilityLabel={IMAGE_UNAVAILABLE_LABEL} style={frame}>
          {icon('cloud-offline-outline')}
          {variant === 'gallery' ? (
            <BodyText tone="textMuted">{IMAGE_UNAVAILABLE_LABEL}</BodyText>
          ) : null}
        </View>
      );
  }
}
