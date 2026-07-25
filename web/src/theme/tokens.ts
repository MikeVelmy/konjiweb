/**
 * Design tokens ported from konji-visual-direction-v2.html.
 *
 * Semantics carry across both themes: `ink` is always the page background and
 * `paper` is always the text that sits on it — in the light theme those are a
 * warm nude and a dark brown rather than the dark-theme soft black and off-white.
 * Only the values change between themes, never the meaning, which is what lets
 * every component read from one palette shape.
 */

export type ThemeName = 'dark' | 'light';

export type Palette = {
  ink: string;
  panel: string;
  panel2: string;
  line: string;
  paper: string;
  paperDim: string;
  red: string;
  redDeep: string;
  amber: string;
  amberDeep: string;
  onAccent: string;
  /** Hard black outline used on the "game button" chrome. */
  outline: string;
  online: string;
  glowInk: string;
  glowInk2: string;
};

export const palettes: Record<ThemeName, Palette> = {
  dark: {
    ink: '#121110',
    panel: '#1D1B19',
    panel2: '#262320',
    line: '#3A352F',
    paper: '#F7F3EE',
    paperDim: '#B9B2A8',
    red: '#FF4438',
    redDeep: '#7A1E19',
    amber: '#FFB020',
    amberDeep: '#6B4A12',
    onAccent: '#1A0503',
    outline: '#000000',
    online: '#6FCB6F',
    glowInk: '#2A1210',
    glowInk2: '#241512',
  },
  light: {
    ink: '#F2E6D8',
    panel: '#EAD9C3',
    panel2: '#E2CBAE',
    line: '#C9AF8E',
    paper: '#2A2018',
    paperDim: '#6E5C48',
    red: '#8C2F39',
    redDeep: '#E8C9CC',
    amber: '#A9780F',
    amberDeep: '#C9A24A',
    onAccent: '#FDF6EF',
    outline: '#2A2018',
    online: '#3E7A3E',
    glowInk: '#ECD3CE',
    glowInk2: '#EFDCC4',
  },
};

/**
 * The avatar colours a user can pick from. These are theme-independent on
 * purpose — an avatar has to look like the same person in either theme, since
 * it is the user's only identity before a face reveal.
 */
export const avatarColors = [
  { id: 'red', hex: '#FF4438' },
  { id: 'amber', hex: '#FFB020' },
  { id: 'green', hex: '#6FCB6F' },
  { id: 'blue', hex: '#5B9BD5' },
  { id: 'paper', hex: '#F7F3EE' },
  { id: 'violet', hex: '#A98BE0' },
  { id: 'teal', hex: '#4FC3B5' },
  { id: 'pink', hex: '#F58BB0' },
] as const;

export type AvatarColorId = (typeof avatarColors)[number]['id'];

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 7,
  md: 8,
  lg: 10,
  xl: 14,
} as const;

export const type = {
  screenTitle: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.3 },
  title: { fontSize: 20, fontWeight: '800' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  label: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
  button: { fontSize: 15, fontWeight: '800' as const },
  caption: { fontSize: 12, fontWeight: '600' as const },
} as const;
