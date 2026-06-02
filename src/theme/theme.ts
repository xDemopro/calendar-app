// Legacy compat layer — the real design tokens live in ./tokens.ts.
// New code should use `useThemeColors()` (theme-aware) and import `type`/`space`/`radius`
// from `./tokens`. The named exports below match the old API and resolve to the LIGHT
// palette; theme-aware components must read from `useThemeColors()` to follow dark mode.

import { light, radius as r, space as s, type as t } from './tokens';

export const colors = {
  // new names
  bg: light.bg,
  bgElev: light.bgElev,
  bgRaised: light.bgRaised,
  ink: light.ink,
  fgMed: light.fgMed,
  fgLow: light.fgLow,
  border: light.border,
  borderStr: light.borderStr,
  accent: light.accent,
  accentSoft: light.accentSoft,
  onAccent: light.onAccent,
  today: light.today,
  danger: light.danger,
  success: light.success,
  warning: light.warning,
  // legacy aliases (kept so untouched code still compiles)
  text: light.ink,
  textMuted: light.fgMed,
  bgElevated: light.bgElev,
  card: light.bgRaised,
  primary: light.accent,
  inputBg: light.bgElev,
  primaryText: light.onAccent,
};

export const spacing = {
  xs: s.xs,
  sm: s.sm,
  md: s.md,
  lg: s.lg,
  xl: s.xl,
  xxl: s.xxl,
};

export const radius = r;

// Legacy `typography` exposed the body shapes only. Map them onto the new type scale.
export const typography = {
  title: t.title1,
  subtitle: t.title3,
  body: t.body,
  muted: { ...t.subhead, color: light.fgMed },
  small: { ...t.footnote, color: light.fgLow },
};

// Re-export new tokens for convenience.
export { type } from './tokens';
