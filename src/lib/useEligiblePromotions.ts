import type { Customer } from '../types'
import { useActiveLoyaltyPrograms, useSettings } from './queries'
import { shouldRemindBirthday } from './birthday'
import { formatReward } from './reward'
import type { Promotion } from '../components/PromotionsModal'

// Compute every promo a customer is eligible for right now: one redeemable promo
// per active loyalty program they have enough points for, plus a birthday
// discount if in-window and unclaimed this year. Shared by the phone-entry
// prompt and the persistent header link so the two never drift.
export function useEligiblePromotions(customer: Customer | null): Promotion[] {
  const { data: programs } = useActiveLoyaltyPrograms()
  const { data: settings } = useSettings()

  if (!customer) return []

  const promotions: Promotion[] = []

  for (const p of programs ?? []) {
    if (customer.pointsBalance >= p.pointsPerReward) {
      promotions.push({
        id: `points-${p.id}`,
        kind: 'points',
        programId: p.id,
        title: p.name,
        detail: `Redeem ${p.pointsPerReward} points for ${formatReward(p.rewardType, p.rewardValue)}`,
        actionLabel: 'Redeem',
      })
    }
  }

  if (
    settings != null &&
    shouldRemindBirthday(
      customer.birthday,
      customer.birthdayRedeemedYear,
      new Date(),
      settings.birthdayDaysBefore,
      settings.birthdayDaysAfter,
    )
  ) {
    promotions.push({
      id: 'birthday',
      kind: 'birthday',
      title: '🎂 Birthday discount',
      detail: 'Happy birthday! Claim your birthday treat today.',
      actionLabel: 'Claim',
    })
  }

  return promotions
}
