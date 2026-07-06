import { useState } from 'react'
import { useActiveLoyaltyPrograms, useSettings } from '../lib/queries'
import { useKioskFlow } from '../routes/kiosk/useKioskFlow'
import { shouldRemindBirthday } from '../lib/birthday'
import { formatReward } from '../lib/reward'
import { PromotionsModal, type Promotion } from './PromotionsModal'

// Single unified entry point (shown in the kiosk header) for every promo the
// identified customer is eligible for — one per active loyalty program they can
// redeem, plus a birthday discount. Hidden when nothing is eligible.
export function PromotionsLink() {
  const flow = useKioskFlow()
  const { data: programs } = useActiveLoyaltyPrograms()
  const { data: settings } = useSettings()
  const [open, setOpen] = useState(false)

  const customer = flow.customer
  if (!customer) return null

  const promotions: Promotion[] = []

  // One redeemable promo per active program the customer has enough points for.
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

  // Birthday discount (in window and not claimed this year).
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

  if (promotions.length === 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-500/20 px-4 py-2.5 text-base font-semibold text-brand-200 hover:bg-brand-500/30"
      >
        🎁 {promotions.length} reward{promotions.length > 1 ? 's' : ''} available
      </button>

      {open && (
        <PromotionsModal
          customer={customer}
          promotions={promotions}
          onCustomerChange={(patch) => flow.setCustomer({ ...customer, ...patch })}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
