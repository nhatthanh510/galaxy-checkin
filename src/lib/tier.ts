// Customer loyalty tier, derived from LIFETIME points (total ever earned, which
// doesn't drop on redeem). Thresholds:
//   1        -> New
//   2..10    -> Regular
//   > 10     -> VIP
//   0        -> no tier (no badge)
export type CustomerTier = 'new' | 'regular' | 'vip'

export function customerTier(lifetimePoints: number): CustomerTier | null {
  if (lifetimePoints <= 0) return null
  if (lifetimePoints === 1) return 'new'
  if (lifetimePoints <= 10) return 'regular'
  return 'vip'
}

// Label + tailwind classes for a tier badge (light admin theme).
export function tierBadge(tier: CustomerTier): { label: string; className: string } {
  switch (tier) {
    case 'vip':
      return { label: '⭐ VIP', className: 'bg-amber-100 text-amber-700' }
    case 'regular':
      return { label: 'Regular', className: 'bg-blue-100 text-blue-700' }
    case 'new':
      return { label: 'New', className: 'bg-emerald-100 text-emerald-700' }
  }
}
