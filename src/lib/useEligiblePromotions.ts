import type { Customer } from '../types'
import { useActiveLoyaltyPrograms, useSettings } from './queries'
import { shouldClaimDateWindow } from './birthday'
import { formatReward } from './reward'
import { birthdayPercentForTier, customerTier, tierBadgeKiosk, tierName } from './tier'

// One eligible promotion — a redeemable loyalty program. All are redeemed via
// redeem_points by programId; the trigger decides what changes on the customer.
export interface Promotion {
  id: string
  programId: string
  // A date_window/always claim stamps birthday_redeemed_year (once-per-year
  // guard); a points claim decrements the balance. This flag says which patch
  // to apply after a successful redeem.
  stampsYear: boolean
  title: string
  // The reward value to highlight prominently (e.g. "15% off", "$10 off"). For
  // birthday rewards this is the tier-based percent, so it draws the eye without
  // restating the tier. Optional — falls back to plain `detail` when absent.
  highlight?: string
  detail: string
  actionLabel: string
  // A small tier cue (e.g. "New" / "Regular" / "VIP") for tier-based rewards, so
  // the customer knows the discount reflects their standing. `tierNoteClass` is
  // the tier's kiosk colour so it matches the tier badge on the customer card.
  tierNote?: string
  tierNoteClass?: string
}

// Compute every promo a customer is eligible for right now. All are redeemed via
// redeem_points (by program id); eligibility is decided by the program trigger:
//   - 'points'      — customer has enough points
//   - 'date_window' — today is within the program's per-program window around the
//                     customer's anchor date (birthday), not yet claimed this year
//   - 'always'      — always eligible (standing promo / welcome offer)
// Shared by the kiosk rewards UI so all surfaces stay consistent.
export function useEligiblePromotions(customer: Customer | null): Promotion[] {
  const { data: programs } = useActiveLoyaltyPrograms()
  const { data: settings } = useSettings()

  if (!customer) return []

  const promotions: Promotion[] = []

  // Birthday percents by tier — configured in app_settings, applied per-customer.
  const tierPercents = {
    new: settings?.birthdayPercentNew ?? 10,
    regular: settings?.birthdayPercentRegular ?? 15,
    vip: settings?.birthdayPercentVip ?? 20,
  }

  for (const p of programs ?? []) {
    const reward = formatReward(p.rewardType, p.rewardValue)

    if (p.triggerType === 'date_window') {
      // Per-program window; fall back to the global birthday defaults.
      const before = p.windowBeforeDays ?? settings?.birthdayDaysBefore ?? 7
      const after = p.windowAfterDays ?? settings?.birthdayDaysAfter ?? 7
      // Only 'birthday' anchor exists today; extend here when more are added.
      const anchorDate = p.dateAnchor === 'birthday' ? customer.birthday : null
      // Not on a customer's FIRST visit: a brand-new customer who enters a
      // birthday near today would otherwise claim it on sign-up. `customer` here
      // is post-check-in, so visitCount == 1 means this is their first visit —
      // the birthday reward opens from the second visit onward.
      const returning = customer.visitCount >= 2
      const eligible =
        returning &&
        shouldClaimDateWindow(
          anchorDate,
          customer.birthdayRedeemedYear,
          new Date(),
          before,
          after,
        )
      if (eligible) {
        // Birthday discount is tier-based (New/Regular/VIP), not the program's
        // fixed reward_value — so the kiosk shows the exact % this customer gets.
        // The tier itself is shown on the customer card, not repeated here.
        const pct = birthdayPercentForTier(customer.lifetimePoints, tierPercents)
        const tier = customerTier(customer.lifetimePoints)
        promotions.push({
          id: `program-${p.id}`,
          programId: p.id,
          stampsYear: true,
          title: `🎂 ${p.name}`,
          highlight: `${pct}% off`,
          detail: 'Happy birthday! 🎉',
          tierNote: tierName(tier),
          tierNoteClass: tierBadgeKiosk(tier).className,
          actionLabel: 'Claim',
        })
      }
    } else if (p.triggerType === 'always') {
      promotions.push({
        id: `program-${p.id}`,
        programId: p.id,
        stampsYear: true, // once-per-year guard also applies to standing promos
        title: p.name,
        highlight: reward,
        detail: 'Standing offer',
        actionLabel: 'Claim',
      })
    } else if (p.pointsPerReward > 0 && customer.pointsBalance >= p.pointsPerReward) {
      promotions.push({
        id: `program-${p.id}`,
        programId: p.id,
        stampsYear: false,
        title: p.name,
        highlight: reward,
        detail: `Redeem ${p.pointsPerReward} points`,
        actionLabel: 'Redeem',
      })
    }
  }

  return promotions
}
