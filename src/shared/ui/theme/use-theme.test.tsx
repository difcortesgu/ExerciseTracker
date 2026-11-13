import { renderHook } from '@testing-library/react-native';
import { useColorScheme } from 'react-native';

import { darkTheme, lightTheme, type Theme } from './tokens';
import { useTheme } from './use-theme';

/** WCAG 2.x relative luminance of a `#RRGGBB` colour. */
function relativeLuminance(hexColor: string): number {
  const channels = [1, 3, 5].map((start) => parseInt(hexColor.slice(start, start + 2), 16) / 255);
  const [red = 0, green = 0, blue = 0] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (first, second) => second - first,
  );
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

/** WCAG AAA for body text: readable at arm's length mid-workout. */
const AAA_TEXT_CONTRAST = 7;
/** WCAG AA for large text and UI components (accent colour, error colour). */
const AA_LARGE_CONTRAST = 4.5;

describe('useTheme', () => {
  afterEach(() => {
    jest.mocked(useColorScheme).mockReset();
  });

  it('returns the light theme when the device uses light mode', async () => {
    jest.mocked(useColorScheme).mockReturnValue('light');

    const { result } = await renderHook(() => useTheme());

    expect(result.current).toBe(lightTheme);
  });

  it('returns the dark theme when the device uses dark mode', async () => {
    jest.mocked(useColorScheme).mockReturnValue('dark');

    const { result } = await renderHook(() => useTheme());

    expect(result.current).toBe(darkTheme);
  });

  it('falls back to the light theme when the device reports no preference', async () => {
    jest.mocked(useColorScheme).mockReturnValue(null);

    const { result } = await renderHook(() => useTheme());

    expect(result.current).toBe(lightTheme);
  });
});

describe.each<[string, Theme]>([
  ['light', lightTheme],
  ['dark', darkTheme],
])('%s theme contrast', (_name, theme) => {
  const { colors } = theme;

  it('keeps text and muted text at AAA contrast on the background', () => {
    expect(contrastRatio(colors.text, colors.background)).toBeGreaterThanOrEqual(AAA_TEXT_CONTRAST);
    expect(contrastRatio(colors.textMuted, colors.background)).toBeGreaterThanOrEqual(
      AAA_TEXT_CONTRAST,
    );
  });

  it('keeps the accent and danger colours at AA contrast on the background', () => {
    expect(contrastRatio(colors.accent, colors.background)).toBeGreaterThanOrEqual(
      AA_LARGE_CONTRAST,
    );
    expect(contrastRatio(colors.danger, colors.background)).toBeGreaterThanOrEqual(
      AA_LARGE_CONTRAST,
    );
  });
});
