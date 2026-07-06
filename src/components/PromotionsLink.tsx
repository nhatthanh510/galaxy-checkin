import { useState } from 'react'
import { useKioskFlow } from '../routes/kiosk/useKioskFlow'
import { useEligiblePromotions } from '../lib/useEligiblePromotions'
import { PromotionsModal } from './PromotionsModal'

// Single unified entry point (shown in the kiosk header) for every promo the
// identified customer is eligible for — one per active loyalty program they can
// redeem, plus a birthday discount. Hidden when nothing is eligible.
export function PromotionsLink() {
  const flow = useKioskFlow()
  const [open, setOpen] = useState(false)
  const customer = flow.customer
  const promotions = useEligiblePromotions(customer)

  if (!customer || promotions.length === 0) return null

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
