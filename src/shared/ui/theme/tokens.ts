/**
 * Design tokens (shared/ui design system). Screens and components never hard-code colours,
 * spacing, font sizes or font weights; they read them from the active `Theme` (see `useTheme`).
 *
 * Contrast is chosen for reading at arm's length mid-workout: text and muted text meet WCAG AAA
 * (7:1) on the background, accent and danger colours meet AA (4.5:1). The theme tests enforce it.
 */

import type { TextStyle } from 'react-native';

export interface ThemeColors {
  readonly background: string;
  readonly surface: string;
  readonly text: string;
  readonly textMuted: string;
  readonly accent: string;
  readonly danger: string;
  readonly border: string;
}

export interface ThemeSpacing {
  readonly small: number;
  readonly medium: number;
  readonly large: number;
}

export interface ThemeTypography {
  readonly headingSize: number;
  readonly bodySize: number;
  readonly tabLabelSize: number;
  /** Weight for text that must stand out at a glance (headings, tab labels). */
  readonly strongWeight: NonNullable<TextStyle['fontWeight']>;
}

export interface Theme {
  readonly colors: ThemeColors;
  readonly spacing: ThemeSpacing;
  readonly typography: ThemeTypography;
}

const spacing: ThemeSpacing = Object.freeze({ small: 8, medium: 16, large: 24 });

const typography: ThemeTypography = Object.freeze({
  headingSize: 32,
  bodySize: 18,
  tabLabelSize: 14,
  strongWeight: 'bold',
});

export const lightTheme: Theme = Object.freeze({
  colors: Object.freeze({
    background: '#FFFFFF',
    surface: '#F2F4F7',
    text: '#0B0D12',
    textMuted: '#3D4452',
    accent: '#0B5FD9',
    danger: '#B42318',
    border: '#C9CED6',
  }),
  spacing,
  typography,
});

export const darkTheme: Theme = Object.freeze({
  colors: Object.freeze({
    background: '#0B0D12',
    surface: '#171A21',
    text: '#F5F7FA',
    textMuted: '#B8BFCC',
    accent: '#5AA2FF',
    danger: '#FF7B70',
    border: '#2E3440',
  }),
  spacing,
  typography,
});
