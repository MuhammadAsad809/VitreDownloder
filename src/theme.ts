/**
 * Vitre centralized theme — Apple-inspired "Liquid Glass" design system.
 * Emerald accents on deep black/graphite, refined typography scale, consistent radii.
 */

export type ThemeMode = 'system' | 'dark' | 'light';

const darkPalette = {
  isDark: true,
  bg: '#050706',
  bgDeep: '#030404',
  gradient: ['#0A1512', '#07110D', '#040706'] as string[],
  text: '#F2FBF5',
  textSecondary: '#9DB0A6',
  textMuted: '#6C8077',
  accent: '#A5FFC5',
  accentStrong: '#7CE3A1',
  accentInk: '#07180F',
  accentSoftBg: 'rgba(155, 255, 192, 0.10)',
  accentSoftBorder: 'rgba(155, 255, 192, 0.22)',
  glassBg: 'rgba(255, 255, 255, 0.055)',
  glassBgHeavy: 'rgba(16, 26, 22, 0.82)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  glassBorderTop: 'rgba(255, 255, 255, 0.26)',
  hairline: 'rgba(255, 255, 255, 0.08)',
  track: 'rgba(255, 255, 255, 0.09)',
  danger: '#FF9E9E',
  dangerBg: 'rgba(255, 120, 120, 0.10)',
  warning: '#FFD9A0',
  overlay: 'rgba(2, 5, 4, 0.72)',
  placeholderBg: '#101B16',
};

const lightPalette = {
  isDark: false,
  bg: '#F2F5F2',
  bgDeep: '#EAEFEA',
  gradient: ['#EFF5EF', '#E6EEE7', '#DFE9E2'] as string[],
  text: '#0C1A12',
  textSecondary: '#4A5C52',
  textMuted: '#71827A',
  accent: '#0E7A43',
  accentStrong: '#0B6437',
  accentInk: '#FFFFFF',
  accentSoftBg: 'rgba(14, 122, 67, 0.10)',
  accentSoftBorder: 'rgba(14, 122, 67, 0.25)',
  glassBg: 'rgba(255, 255, 255, 0.72)',
  glassBgHeavy: 'rgba(255, 255, 255, 0.86)',
  glassBorder: 'rgba(20, 40, 30, 0.10)',
  glassBorderTop: 'rgba(255, 255, 255, 0.9)',
  hairline: 'rgba(20, 40, 30, 0.08)',
  track: 'rgba(20, 40, 30, 0.10)',
  danger: '#B3261E',
  dangerBg: 'rgba(179, 38, 30, 0.08)',
  warning: '#8A5A00',
  overlay: 'rgba(20, 30, 25, 0.35)',
  placeholderBg: '#DDE7DF',
};

export const palettes = { dark: darkPalette, light: lightPalette };
export type Palette = typeof darkPalette;

/** Corner radius scale used across the app. */
export const radius = { sm: 10, md: 14, lg: 18, xl: 24, xxl: 28, pill: 999 };

/** Typography scale. */
export const typography = {
  heroTitle: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -1.2 },
  pageTitle: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -1 },
  section: { fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 13, fontWeight: '500' as const },
  caption: { fontSize: 11, fontWeight: '500' as const },
  micro: { fontSize: 9.5, fontWeight: '800' as const, letterSpacing: 1.3 },
};

export function getPalette(mode: ThemeMode, systemDark: boolean): Palette {
  if (mode === 'light') return lightPalette;
  if (mode === 'dark') return darkPalette;
  return systemDark ? darkPalette : lightPalette;
}
