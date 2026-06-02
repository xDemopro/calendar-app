// Design tokens ported from the design direction (warm "paper" / "fireside" themes).
// Source of truth: see Claude design — tokens.js.

export type ThemeMode = 'system' | 'light' | 'dark';

export type ThemePalette = {
  name: 'light' | 'dark';
  bg: string;
  bgElev: string;
  bgRaised: string;
  ink: string;
  fgMed: string;
  fgLow: string;
  border: string;
  borderStr: string;
  accent: string;
  accentSoft: string; // 14-16% alpha accent for tints / chips
  onAccent: string;
  today: string;
  danger: string;
  success: string;
  warning: string;
  sheet: string; // backdrop tint for sheets / context menus
  // shadows are strings only used for cross-platform notes
  shadow1: string;
  shadow2: string;
  shadow3: string;
  barShadow: string;
};

export const light: ThemePalette = {
  name: 'light',
  bg: '#F3ECDE',
  bgElev: '#FAF4E9',
  bgRaised: '#FFFDF8',
  ink: '#2B251C',
  fgMed: '#6B6253',
  fgLow: '#9D9482',
  border: '#E6DCC9',
  borderStr: '#D8CCB4',
  accent: '#B47B26',
  accentSoft: 'rgba(180,123,38,0.14)',
  onAccent: '#FFFCF4',
  today: '#B47B26',
  danger: '#C0503F',
  success: '#5E8F5C',
  warning: '#C28A2C',
  sheet: 'rgba(43,37,28,0.34)',
  shadow1: '0 1px 2px rgba(58,44,20,0.06)',
  shadow2: '0 4px 14px rgba(58,44,20,0.09)',
  shadow3: '0 16px 40px rgba(58,44,20,0.14)',
  barShadow: '0 1px 2px rgba(58,44,20,0.10)',
};

export const dark: ThemePalette = {
  name: 'dark',
  bg: '#171411',
  bgElev: '#201C17',
  bgRaised: '#29241D',
  ink: '#F4EEE2',
  fgMed: '#B4AB9A',
  fgLow: '#807665',
  border: '#332D24',
  borderStr: '#443B30',
  accent: '#E6A848',
  accentSoft: 'rgba(230,168,72,0.16)',
  onAccent: '#211806',
  today: '#E6A848',
  danger: '#E0796A',
  success: '#7FB07C',
  warning: '#E0A84A',
  sheet: 'rgba(8,6,4,0.55)',
  shadow1: '0 1px 2px rgba(0,0,0,0.4)',
  shadow2: '0 6px 18px rgba(0,0,0,0.45)',
  shadow3: '0 18px 44px rgba(0,0,0,0.55)',
  barShadow: '0 1px 3px rgba(0,0,0,0.45)',
};

// 10-hue per-event palette — muted, paper-friendly.
// Each entry has the solid color (used for text + dot) and the bar background tint
// for both modes.
export type EventColor = {
  key: string;
  solidLight: string;
  solidDark: string;
  barLight: string;
  barDark: string;
};

export const EVENT_PALETTE: EventColor[] = [
  { key: 'rose',   solidLight: '#C0697A', solidDark: '#D98494', barLight: 'rgba(192,105,122,0.16)', barDark: 'rgba(217,132,148,0.20)' },
  { key: 'clay',   solidLight: '#C5704F', solidDark: '#DD8B6A', barLight: 'rgba(197,112,79,0.16)',  barDark: 'rgba(221,139,106,0.20)' },
  { key: 'amber',  solidLight: '#BD8E2E', solidDark: '#DCAE4C', barLight: 'rgba(189,142,46,0.17)',  barDark: 'rgba(220,174,76,0.20)' },
  { key: 'olive',  solidLight: '#8E9447', solidDark: '#AEB463', barLight: 'rgba(142,148,71,0.18)',  barDark: 'rgba(174,180,99,0.20)' },
  { key: 'sage',   solidLight: '#5C9A6E', solidDark: '#7DBA8C', barLight: 'rgba(92,154,110,0.16)',  barDark: 'rgba(125,186,140,0.20)' },
  { key: 'teal',   solidLight: '#3F9696', solidDark: '#5FB3B3', barLight: 'rgba(63,150,150,0.16)',  barDark: 'rgba(95,179,179,0.20)' },
  { key: 'sky',    solidLight: '#5189C4', solidDark: '#74A6DE', barLight: 'rgba(81,137,196,0.16)',  barDark: 'rgba(116,166,222,0.20)' },
  { key: 'indigo', solidLight: '#6E76C2', solidDark: '#9098DA', barLight: 'rgba(110,118,194,0.16)', barDark: 'rgba(144,152,218,0.20)' },
  { key: 'plum',   solidLight: '#9866B8', solidDark: '#B488D2', barLight: 'rgba(152,102,184,0.16)', barDark: 'rgba(180,136,210,0.20)' },
  { key: 'red',    solidLight: '#C25C4E', solidDark: '#DC7C6E', barLight: 'rgba(194,92,78,0.16)',   barDark: 'rgba(220,124,110,0.20)' },
];

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 9999 };
export const space  = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

// Type tokens. Sizes/line-heights/letterspacing match the design's Hanken Grotesk scale.
// On RN, custom fonts don't auto-bold based on fontWeight, so each token picks the
// matching weighted family.
export const FONT_FAMILY_BY_WEIGHT: Record<'400' | '500' | '600' | '700' | '800', string> = {
  '400': 'HankenGrotesk_400Regular',
  '500': 'HankenGrotesk_500Medium',
  '600': 'HankenGrotesk_600SemiBold',
  '700': 'HankenGrotesk_700Bold',
  '800': 'HankenGrotesk_800ExtraBold',
};

type TypeStyle = {
  fontFamily: string;
  fontSize: number;
  fontWeight: '400' | '500' | '600' | '700' | '800';
  lineHeight: number;
  letterSpacing: number;
};

function t(size: number, weight: TypeStyle['fontWeight'], lh: number, ls = 0): TypeStyle {
  return {
    fontFamily: FONT_FAMILY_BY_WEIGHT[weight],
    fontSize: size,
    fontWeight: weight,
    lineHeight: lh,
    letterSpacing: ls,
  };
}

export const type = {
  display:  t(34, '800', 40, -0.4),
  title1:   t(28, '800', 34, -0.3),
  title2:   t(22, '700', 28, -0.2),
  title3:   t(19, '700', 24, -0.1),
  headline: t(17, '700', 22, -0.1),
  body:     t(17, '400', 23, 0),
  callout:  t(16, '500', 21, 0),
  subhead:  t(15, '600', 20, 0),
  footnote: t(13, '600', 17, 0.1),
  caption:  t(12, '600', 15, 0.2),
  micro:    t(11, '700', 14, 0.4),
} as const;

// Motion guidelines: cubic-bezier(.22,.61,.36,1) standard ease.
export const motion = {
  ease: 'standard',
  tap: 120,
  fade: 180,
  transition: 240,
  sheet: 320,
  // Reanimated spring for the context-menu (card scales to 1.04).
  contextSpring: { stiffness: 320, damping: 26, mass: 1 },
};

// Re-export weight families for Font.loadAsync.
export const FONT_WEIGHTS = FONT_FAMILY_BY_WEIGHT;
