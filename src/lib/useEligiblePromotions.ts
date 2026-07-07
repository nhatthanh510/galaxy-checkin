import type { Customer } from '../types'
import { useActiveLoyaltyPrograms, useSettings } from './queries'
import { shouldClaimDateWindow } from './birthday'
import { formatReward } from './reward'
import type { Promotion } from '../components/PromotionsModal'

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

  for (const p of programs ?? []) {
    const reward = formatReward(p.rewardType, p.rewardValue)

    if (p.triggerType === 'date_window') {
      // Per-program window; fall back to the global birthday defaults.
      const before = p.windowBeforeDays ?? settings?.birthdayDaysBefore ?? 7
      const after = p.windowAfterDays ?? settings?.birthdayDaysAfter ?? 7
      // Only 'birthday' anchor exists today; extend here when more are added.
      const anchorDate = p.dateAnchor === 'birthday' ? customer.birthday : null
      const eligible = shouldClaimDateWindow(
        anchorDate,
        customer.birthdayRedeemedYear,
        new Date(),
        before,
        after,
      )
      if (eligible) {
        promotions.push({
          id: `program-${p.id}`,
          programId: p.id,
          stampsYear: true,
          title: `🎂 ${p.name}`,
          detail: `${reward} — Happy birthday!`,
          actionLabel: 'Claim',
        })
      }
    } else if (p.triggerType === 'always') {
      promotions.push({
        id: `program-${p.id}`,
        programId: p.id,
        stampsYear: true, // once-per-year guard also applies to standing promos
        title: p.name,
        detail: reward,
        actionLabel: 'Claim',
      })
    } else if (customer.pointsBalance >= p.pointsPerReward) {
      promotions.push({
        id: `program-${p.id}`,
        programId: p.id,
        stampsYear: false,
        title: p.name,
        detail: `Redeem ${p.pointsPerReward} points for ${reward}`,
        actionLabel: 'Redeem',
      })
    }
  }

  return promotions
}
