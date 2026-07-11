// Customer loyalty tier, derived from LIFETIME points (total ever earned, which
// doesn't drop on redeem). Thresholds:
//   0..4     -> New
//   5..19    -> Regular
//   >= 20    -> VIP
export type CustomerTier = 'new' | 'regular' | 'vip'

export function customerTier(lifetimePoints: number): CustomerTier {
  if (lifetimePoints < 5) return 'new'
  if (lifetimePoints < 20) return 'regular'
  return 'vip'
}

// Plain human label for a tier ("New" / "Regular" / "VIP"), for inline text.
export function tierName(tier: CustomerTier): string {
  return tier === 'vip' ? 'VIP' : tier === 'regular' ? 'Regular' : 'New'
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

// A bold tier badge for the DARK kiosk theme — bright, celebratory, so the
// customer sees their tier at a glance on the greeting screen.
export function tierBadgeKiosk(tier: CustomerTier): { label: string; className: string } {
  switch (tier) {
    case 'vip':
      return { label: '⭐ VIP', className: 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-300/40' }
    case 'regular':
      return {
        label: '💎 Regular',
        className: 'bg-sky-400/20 text-sky-300 ring-1 ring-sky-300/40',
      }
    case 'new':
      return {
        label: '✨ New',
        className: 'bg-emerald-400/20 text-emerald-300 ring-1 ring-emerald-300/40',
      }
  }
}

// The birthday discount percent for each tier, as configured in app_settings.
// New/Regular/VIP each get their own percent (defaults 10/15/20). Used by the
// kiosk rewards UI and the send-birthday-sms edge function so the number a
// customer sees at check-in matches the number they get by text.
export interface BirthdayTierPercents {
  new: number
  regular: number
  vip: number
}

export function birthdayPercentForTier(
  lifetimePoints: number,
  percents: BirthdayTierPercents,
): number {
  return percents[customerTier(lifetimePoints)]
}

// Admin-facing summary of the tier percents, stored as the birthday program's
// description so the Loyalty list/detail always reflect the configured values.
// e.g. "Birthday: 10% (New) / 15% (Regular) / 20% (VIP) off".
export function birthdayTierSummary(percents: BirthdayTierPercents): string {
  return `Birthday: ${percents.new}% (New) / ${percents.regular}% (Regular) / ${percents.vip}% (VIP) off`
}

// Customer-facing kiosk blurb for the birthday card, shown before a customer is
// identified (no tier known yet). Leads with the entry perk and dangles the top
// tier to encourage customers to climb — without over-promising the max to all.
// e.g. "10% off on your birthday — up to 20% for VIPs 🎂" (collapses to a single
// figure when every tier is the same).
export function birthdayKioskBlurb(percents: BirthdayTierPercents): string {
  const min = Math.min(percents.new, percents.regular, percents.vip)
  const max = Math.max(percents.new, percents.regular, percents.vip)
  if (min === max) return `${max}% off on your birthday 🎂`
  return `${min}% off on your birthday — up to ${max}% for VIPs 🎂`
}
