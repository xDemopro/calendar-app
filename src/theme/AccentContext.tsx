// Backwards-compat shim: the screen of design tokens has moved to ./ThemeContext.
// This file re-exports the new API under the old names so existing imports keep working.
export {
  ThemeProvider as AccentProvider,
  useThemeColors,
  useTheme,
} from './ThemeContext';

// `ACCENT_PRESETS` used to live here; it's deprecated (the design dropped the
// user-selectable accent picker in favor of light/dark mode).
export const ACCENT_PRESETS: { key: string; label: string; value: string }[] = [];

// Stub so any leftover `useAccent()` call doesn't crash; returns the current
// accent from the active theme.
import { useTheme as _useTheme } from './ThemeContext';
export function useAccent() {
  const t = _useTheme();
  return { accent: t.tokens.accent, setAccent: (_: string) => {} };
}
