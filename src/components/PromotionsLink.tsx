import { useState } from 'react'
import { useLoyaltyProgram, useSettings } from '../lib/queries'
import { useKioskFlow } from '../routes/kiosk/useKioskFlow'
import { shouldRemindBirthday } from '../lib/birthday'
import { PromotionsModal, type Promotion } from './PromotionsModal'

// Single unified entry point (shown in the kiosk header) for every promo the
// identified customer is eligible for — points redeem, birthday discount, etc.
// Hidden entirely when nothing is eligible. Replaces the separate points banner
// and birthday reminder.
export function PromotionsLink() {
  const flow = useKioskFlow()
  const { data: program } = useLoyaltyProgram()
  const { data: settings } = useSettings()
  const [open, setOpen] = useState(false)

  const customer = flow.customer
  if (!customer) return null

  const promotions: Promotion[] = []

  // Points redeem.
  if (program != null && customer.pointsBalance >= program.pointsPerReward) {
    promotions.push({
      key: 'points',
      title: 'Loyalty reward',
      detail: `Redeem ${program.pointsPerReward} points for $${program.rewardAmount} off`,
      actionLabel: 'Redeem',
    })
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
      key: 'birthday',
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
          program={program ?? null}
          promotions={promotions}
          onCustomerChange={(patch) => flow.setCustomer({ ...customer, ...patch })}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
