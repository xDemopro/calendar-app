import { EVENT_PALETTE, type EventColor } from '@/theme/tokens';

/** Hash an id to a palette index. Same id → same index. */
function hashIndex(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % EVENT_PALETTE.length;
}

/** Deterministic palette entry for a single event id (no de-dup). */
export function paletteForEvent(id: string): EventColor {
  return EVENT_PALETTE[hashIndex(id)];
}

/**
 * Build a Map<eventId, EventColor> that guarantees each event gets a unique
 * palette entry (up to the palette size — beyond that, collisions resume).
 *
 * Each event prefers its hash-based color; if that's taken by an earlier
 * event in the list, we walk forward to the next free slot. The result is
 * stable as long as the events list is in a stable order — we sort by id
 * here so adding/removing events doesn't reshuffle colors.
 */
export function buildEventColorMap(
  events: Array<{ id: string }>,
): Map<string, EventColor> {
  const sorted = [...events].sort((a, b) => a.id.localeCompare(b.id));
  const map = new Map<string, EventColor>();
  const usedIndices = new Set<number>();

  for (const e of sorted) {
    const preferred = hashIndex(e.id);
    let chosen = preferred;
    let attempts = 0;
    while (usedIndices.has(chosen) && attempts < EVENT_PALETTE.length) {
      chosen = (chosen + 1) % EVENT_PALETTE.length;
      attempts++;
    }
    usedIndices.add(chosen);
    map.set(e.id, EVENT_PALETTE[chosen]);
  }
  return map;
}

/** Mode-aware solid color (used for dot, text). */
export function colorForEvent(
  id: string,
  scheme: 'light' | 'dark',
  map?: Map<string, EventColor>,
): string {
  const p = map?.get(id) ?? paletteForEvent(id);
  return scheme === 'dark' ? p.solidDark : p.solidLight;
}

/** Mode-aware tinted background for an event bar. */
export function barBgForEvent(
  id: string,
  scheme: 'light' | 'dark',
  map?: Map<string, EventColor>,
): string {
  const p = map?.get(id) ?? paletteForEvent(id);
  return scheme === 'dark' ? p.barDark : p.barLight;
}
