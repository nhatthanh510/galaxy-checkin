// Pure helpers/consts/types for CustomersList. Kept .ts (no JSX) so the file
// exports only non-component values — avoids the react-refresh warning that
// fires when a module mixes components with plain exports.

// Sort options exposed in the dropdown; all order high→low (most recent first
// for last-visited). Name is the tiebreaker so paging stays deterministic.
export type SortKey = 'lastVisit' | 'points' | 'lifetime' | 'visits'
export const SORT_LABELS: Record<SortKey, string> = {
  lastVisit: 'Last visited',
  points: 'Points balance',
  lifetime: 'Lifetime points',
  visits: 'Visit count',
}

// Sentinel for a gap in the page list.
export const ELLIPSIS = -1

// Build a compact page list around the current page: always the first and last
// page, the current ±1, and ellipsis sentinels for the gaps. Zero-based indices.
export function pageNumbers(current: number, count: number): number[] {
  const pages = new Set<number>([0, count - 1, current])
  if (current - 1 > 0) pages.add(current - 1)
  if (current + 1 < count - 1) pages.add(current + 1)
  const sorted = [...pages].filter((n) => n >= 0 && n < count).sort((a, b) => a - b)

  const out: number[] = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push(ELLIPSIS)
    out.push(sorted[i])
  }
  return out
}
