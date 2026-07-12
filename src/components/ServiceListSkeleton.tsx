// Shimmer placeholder for the kiosk service list while it loads. It's a STATIC
// mirror of the real salon menu — the same 7 groups, and one chip per service
// sized to roughly match each real name — so the loading state has the true
// shape of the list, not a generic guess. Dark theme.
//
// If the salon's groups/services change substantially, update this to match.

// Each group: a header width (rem, ~ the group name) and a chip width per service
// (rem, ~ each service name). Modelled on the live menu:
//   ACRYLIC · BUILDER GEL · COLORS (buff, shape) · DESIGN · MANICURE ·
//   SNS (Dipping powder) · Spa pedicure
const GROUPS: { header: number; chips: number[] }[] = [
  // ACRYLIC — 11 services, mix of short + long names.
  {
    header: 6,
    chips: [12, 15, 15, 15, 12, 13, 8, 11, 10, 13, 8],
  },
  // BUILDER GEL — 3, all long.
  { header: 8, chips: [16, 13, 16] },
  // COLORS (buff, shape) — 3, short/medium.
  { header: 12, chips: [7, 13, 8] },
  // DESIGN — 4.
  { header: 6, chips: [10, 12, 11, 10] },
  // MANICURE — 6, wraps to 2 rows.
  { header: 7, chips: [13, 9, 12, 11, 11, 11] },
  // SNS (Dipping powder) — 9, wraps to 2 rows.
  { header: 12, chips: [12, 12, 12, 11, 9, 14, 8, 13, 15] },
  // Spa pedicure — 4.
  { header: 8, chips: [13, 9, 11, 13] },
]

export function ServiceListSkeleton() {
  return (
    // Fills the remaining height like the real list; clips overflow so the
    // placeholder never shows its own scrollbar.
    <div className="mt-6 min-h-0 flex-1 space-y-8 overflow-hidden px-1 py-1" aria-hidden>
      {GROUPS.map((group, g) => (
        <div key={g}>
          {/* Group header — width ~ the real group name. */}
          <div
            className="mb-3 h-6 animate-pulse rounded bg-white/10"
            style={{ width: `${group.header}rem` }}
          />
          {/* One chip per service — width ~ the real service name. */}
          <div className="flex flex-wrap gap-3">
            {group.chips.map((w, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-2xl bg-white/5"
                style={{ width: `${w}rem` }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
