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
  /** Section titles inside a screen (smaller than the screen heading). */
  readonly subheadingSize: number;
  readonly bodySize: number;
  /** Secondary details (e.g. a row's category and muscles, badges, field errors). */
  readonly captionSize: number;
  readonly tabLabelSize: number;
  /** Weight for text that must stand out at a glance (headings, tab labels). */
  readonly strongWeight: NonNullable<TextStyle['fontWeight']>;
}

/** How tappable controls feel and look; the same in both themes. */
export interface ThemeInteraction {
  /**
   * Minimum height and width of anything tappable, so it can be hit with a thumb mid-workout
   * (above Android's 48 dp guideline).
   */
  readonly minTouchTargetSize: number;
  /** Visible feedback that a tap registered (no colour change needed, works in both themes). */
  readonly pressedOpacity: number;
  /** A control that cannot be used right now (it is also announced as disabled). */
  readonly disabledOpacity: number;
}

/** Corners and outlines of controls and cards. */
export interface ThemeShape {
  readonly cornerRadius: number;
  readonly borderWidth: number;
}

export interface Theme {
  readonly colors: ThemeColors;
  readonly spacing: ThemeSpacing;
  readonly typography: ThemeTypography;
  readonly interaction: ThemeInteraction;
  readonly shape: ThemeShape;
}

const spacing: ThemeSpacing = Object.freeze({ small: 8, medium: 16, large: 24 });

const typography: ThemeTypography = Object.freeze({
  headingSize: 32,
  subheadingSize: 22,
  bodySize: 18,
  captionSize: 15,
  tabLabelSize: 14,
  strongWeight: 'bold',
});

const interaction: ThemeInteraction = Object.freeze({
  minTouchTargetSize: 56,
  pressedOpacity: 0.7,
  disabledOpacity: 0.4,
});

const shape: ThemeShape = Object.freeze({ cornerRadius: 12, borderWidth: 2 });

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
  interaction,
  shape,
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
  interaction,
  shape,
});
