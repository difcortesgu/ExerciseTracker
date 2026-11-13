import type { ReactElement } from 'react';
import { Text } from 'react-native';

import type { ThemeColors } from './theme/tokens';
import { useTheme } from './theme/use-theme';

/** Which theme colour the text uses. */
export type BodyTextTone = keyof Pick<ThemeColors, 'text' | 'textMuted'>;

export interface BodyTextProps {
  readonly children: string;
  readonly tone?: BodyTextTone;
}

/** Paragraph text at the body size of the active theme. */
export function BodyText({ children, tone = 'text' }: BodyTextProps): ReactElement {
  const { colors, typography } = useTheme();

  return <Text style={{ color: colors[tone], fontSize: typography.bodySize }}>{children}</Text>;
}
