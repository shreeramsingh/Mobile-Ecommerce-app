// Design tokens — dark "night ops" theme: deep navy surfaces with a bright
// yellow accent (matches the Bandookwale app mockup).
//
// The gray scale is defined for a DARK UI: low numbers are dark surfaces/borders,
// high numbers are light text. Screens use gray900 for primary text, gray500 for
// muted text, gray200/300 for borders, gray100 for sunken chips and page bg.

export const colors = {
  // Brand accent (yellow)
  gold300: '#FDE68A',
  gold400: '#FCD34D',
  gold500: '#F5B301', // primary accent
  gold600: '#FBBF24', // accent used for text/icons on dark
  gold700: '#B45309',
  headerAccent: '#F5B301',
  onAccent: '#111522', // text/icons on yellow

  // Surfaces
  navy: '#0B1020', // app background / headers
  surface: '#141A2D', // cards
  surfaceAlt: '#1B2238', // inputs, pills, raised elements
  surfaceDeep: '#070B16', // hero / deep panels
  black: '#000000',
  white: '#FFFFFF',

  // Gray scale (dark UI)
  gray50: '#182037',
  gray100: '#0B1020',
  gray200: '#232C45',
  gray300: '#2E3855',
  gray400: '#6E7894',
  gray500: '#9AA3B9',
  gray600: '#B4BCCE',
  gray700: '#CDD3E0',
  gray800: '#E6EAF2',
  gray900: '#FFFFFF',
  gray950: '#070B16',

  blue50: 'rgba(59,130,246,0.14)',
  blue300: '#93C5FD',
  blue500: '#3B82F6',
  blue600: '#3B82F6',
  blue700: '#60A5FA',
  blue900: '#1E3A8A',

  green50: 'rgba(34,197,94,0.14)',
  green500: '#22C55E',
  green600: '#22C55E',
  green700: '#4ADE80',

  red50: 'rgba(239,68,68,0.14)',
  red500: '#EF4444',
  red600: '#F05252',
  red700: '#F87171',

  amber50: 'rgba(245,179,1,0.12)',
  amber500: '#F59E0B',
  amber700: '#FBBF24',

  whatsapp: '#25D366',
} as const;

export const theme = {
  bg: colors.navy,
  surface: colors.surface,
  surfaceMuted: colors.surfaceAlt,
  border: colors.gray200,
  text: colors.gray900,
  textMuted: colors.gray500,
  textSubtle: colors.gray400,
  primary: colors.gold500,
  primaryText: colors.onAccent,
  danger: colors.red600,
  success: colors.green600,
  link: colors.blue700,
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 14, xl: 18, pill: 999 } as const;
export const font = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
} as const;
