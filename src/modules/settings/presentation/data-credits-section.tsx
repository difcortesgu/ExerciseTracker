import type { ReactElement } from 'react';
import { View } from 'react-native';

import { BodyText, Subheading, useTheme } from '@shared/ui';

import { useDataCredits } from './use-data-credits';

/** Settings → Credits: attribution of the built-in exercise data and images (S1-24). */
export function DataCreditsSection(): ReactElement {
  const credits = useDataCredits();
  const { spacing } = useTheme();

  return (
    <View style={{ gap: spacing.small }}>
      <Subheading>Credits</Subheading>
      <View accessibilityLabel="Exercise data credits" style={{ gap: spacing.small }}>
        <BodyText>{credits.attribution}</BodyText>
        <BodyText tone="textMuted">{credits.repositoryUrl}</BodyText>
        <BodyText>{credits.licence}</BodyText>
        <BodyText tone="textMuted">{credits.licenceUrl}</BodyText>
      </View>
    </View>
  );
}
