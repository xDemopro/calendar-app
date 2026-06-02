import { EVENT_PALETTE, type EventColor } from '@/theme/tokens';

/** Deterministic palette entry for an event id. Same event id → same palette entry. */
export function paletteForEvent(id: string): EventColor {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  }
  return EVENT_PALETTE[Math.abs(h) % EVENT_PALETTE.length];
}

/** Mode-aware solid color (used for dot, text). */
export function colorForEvent(id: string, scheme: 'light' | 'dark'): string {
  const p = paletteForEvent(id);
  return scheme === 'dark' ? p.solidDark : p.solidLight;
}

/** Mode-aware tinted background for an event bar. */
export function barBgForEvent(id: string, scheme: 'light' | 'dark'): string {
  const p = paletteForEvent(id);
  return scheme === 'dark' ? p.barDark : p.barLight;
}
