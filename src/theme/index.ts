/**
 * Design tokens. Every colour, spacing step and text style in the app comes from here so a visual
 * change is a one-file change.
 */

export const colors = {
  background: '#FFFFFF',
  surface: '#F4F5F7',
  surfaceSunken: '#E8EAED',
  /** Backdrop for media (thumbnails, player) — dark so video content reads correctly. */
  media: '#101114',
  border: '#DDE0E4',

  text: '#101114',
  textMuted: '#5F6570',
  textInverted: '#FFFFFF',

  accent: '#0A66FF',
  accentPressed: '#0851CC',
  accentSoft: '#E6F0FF',

  success: '#0F8A4A',
  danger: '#C8331F',
  dangerSoft: '#FCEBE8',
  warning: '#9A6100',
  warningSoft: '#FFF4E0',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 28, fontWeight: '700' },
  heading: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '400' },
  bodyStrong: { fontSize: 15, fontWeight: '600' },
  caption: { fontSize: 13, fontWeight: '400' },
  captionStrong: { fontSize: 13, fontWeight: '600' },
  mono: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
} as const;

export type TypographyVariant = keyof typeof typography;
