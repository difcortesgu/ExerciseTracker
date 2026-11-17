import { useCallback, useState, type ReactElement } from 'react';
import {
  FlatList,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { BodyText, useTheme } from '@shared/ui';

import type { ExerciseImageRef } from '../application/exercise-dtos';

import { DownloadImagesLink } from './download-images-link';
import { ExerciseImage } from './exercise-image';

export interface ImageGalleryProps {
  readonly exerciseName: string;
  readonly images: readonly ExerciseImageRef[];
  /** Built-in images can be downloaded in Settings; custom photos cannot (S1-28, T8). */
  readonly offerOfflineDownload: boolean;
}

const imageLabel = (name: string, index: number, count: number) =>
  `${name}, image ${index + 1} of ${count}`;

/**
 * Swipeable image gallery of the detail screen (S1-17): one image per page, a "1 / 2" position
 * indicator, a label per image, and a neutral placeholder when there are none. When an image is
 * not available offline, a built-in's gallery links once to "Download all images" in Settings.
 */
export function ImageGallery({
  exerciseName,
  images,
  offerOfflineDownload,
}: ImageGalleryProps): ReactElement {
  const { spacing } = useTheme();
  const [pageWidth, setPageWidth] = useState(0);
  const [page, setPage] = useState(0);
  const [hasUnavailableImage, setHasUnavailableImage] = useState(false);
  const reportUnavailable = useCallback(() => setHasUnavailableImage(true), []);

  if (images.length === 0) {
    return <ExerciseImage image={null} label={exerciseName} variant="gallery" />;
  }

  const onLayout = (event: LayoutChangeEvent) => setPageWidth(event.nativeEvent.layout.width);
  const onSwiped = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.round(nativeEvent.contentOffset.x / nativeEvent.layoutMeasurement.width));

  return (
    <View style={{ gap: spacing.small }} onLayout={onLayout}>
      <FlatList
        testID="image-gallery"
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_image, index) => String(index)}
        onMomentumScrollEnd={onSwiped}
        renderItem={({ item, index }) => (
          <View style={{ width: pageWidth }}>
            <ExerciseImage
              image={item}
              label={imageLabel(exerciseName, index, images.length)}
              variant="gallery"
              onUnavailable={reportUnavailable}
            />
          </View>
        )}
      />
      <View style={{ alignItems: 'center' }}>
        <BodyText tone="textMuted">{`${page + 1} / ${images.length}`}</BodyText>
      </View>
      {offerOfflineDownload && hasUnavailableImage ? <DownloadImagesLink /> : null}
    </View>
  );
}
