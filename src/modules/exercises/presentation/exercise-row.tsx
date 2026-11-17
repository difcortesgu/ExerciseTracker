import { memo, type ReactElement } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Badge, useTheme } from '@shared/ui';

import type { ExerciseListItem } from '../application/exercise-dtos';

import { ExerciseImage } from './exercise-image';
import { rowDetailsText } from './library-texts';

export const CUSTOM_BADGE_LABEL = 'Custom';

export interface ExerciseRowProps {
  readonly item: ExerciseListItem;
  readonly onOpen: (item: ExerciseListItem) => void;
  /** A built-in's thumbnail cannot be shown (custom photos cannot be downloaded, S1-28). */
  readonly onBuiltInImageUnavailable: () => void;
}

/**
 * One exercise in the library list (S1-16): thumbnail, name, category and primary muscles, and a
 * "Custom" badge for the user's own exercises. Memoised: a fling over ~900 rows re-renders only
 * rows whose item changed.
 */
export const ExerciseRow = memo(function ExerciseRow({
  item,
  onOpen,
  onBuiltInImageUnavailable,
}: ExerciseRowProps): ReactElement {
  const { colors, spacing, typography, interaction } = useTheme();
  const details = rowDetailsText(item);
  const label = [item.name, item.isCustom ? CUSTOM_BADGE_LABEL : null, details]
    .filter((part) => part !== null && part.length > 0)
    .join(', ');

  return (
    <Pressable
      testID="exercise-row"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onOpen(item)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.medium,
        minHeight: interaction.minTouchTargetSize,
        paddingVertical: spacing.small,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        opacity: pressed ? interaction.pressedOpacity : 1,
      })}
    >
      <ExerciseImage
        image={item.coverImage}
        label={item.name}
        variant="thumbnail"
        {...(item.isCustom ? {} : { onUnavailable: onBuiltInImageUnavailable })}
      />
      <View style={{ flex: 1, gap: spacing.small / 2 }}>
        <Text
          style={{
            color: colors.text,
            fontSize: typography.bodySize,
            fontWeight: typography.strongWeight,
          }}
        >
          {item.name}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: typography.captionSize }}>{details}</Text>
        {item.isCustom ? <Badge label={CUSTOM_BADGE_LABEL} /> : null}
      </View>
    </Pressable>
  );
});
