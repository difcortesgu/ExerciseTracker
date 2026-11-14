import type { ReactElement, ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@shared/ui';

export interface PromptActionsProps {
  readonly children: ReactNode;
}

/** Stacks the prompt's buttons full-width at the bottom, in the thumb's reach. */
export function PromptActions({ children }: PromptActionsProps): ReactElement {
  const { spacing } = useTheme();

  return <View style={{ marginTop: 'auto', gap: spacing.medium }}>{children}</View>;
}
