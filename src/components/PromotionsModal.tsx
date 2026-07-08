import { useEffect, useState } from 'react'
import type { Customer } from '../types'
import { useRedeemPoints } from '../lib/queries'
import { playChime } from '../lib/sound'

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
  detail: string
  actionLabel: string
}

interface PromotionsModalProps {
  customer: Customer
  promotions: Promotion[]
  // Update the flow customer after an action so eligibility recomputes.
  onCustomerChange: (patch: Partial<Customer>) => void
  // Called when a POINTS reward is redeemed, so the flow can suppress this
  // visit's +1 check-in point. Not called for birthday/standing claims.
  onPointsRedeemed?: () => void
  onClose: () => void
}

// Lists every promo the customer is eligible for — one per active loyalty
// program they can redeem, plus a birthday discount — each with its own action.
export function PromotionsModal({
  customer,
  promotions,
  onCustomerChange,
  onPointsRedeemed,
  onClose,
}: PromotionsModalProps) {
  const redeem = useRedeemPoints()
  const currentYear = new Date().getFullYear()
  // Which promo is currently being acted on — so only that button shows loading.
  const [actingId, setActingId] = useState<string | null>(null)

  // Attention chime when the rewards prompt appears.
  useEffect(() => {
    playChime()
  }, [])

  const onAct = async (promo: Promotion) => {
    setActingId(promo.id)
    try {
      const result = await redeem.mutateAsync({
        customerId: customer.id,
        programId: promo.programId,
      })
      // Points redeem updates the balance; a date-window claim marks the year so
      // it stops showing until next year.
      if (promo.stampsYear) {
        onCustomerChange({ birthdayRedeemedYear: currentYear })
      } else {
        onCustomerChange({ pointsBalance: result.pointsBalance })
        // A points redeem means this visit's +1 check-in point is not earned.
        onPointsRedeemed?.()
      }
    } finally {
      setActingId(null)
    }
  }

  const busy = actingId != null
  const error = redeem.error

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <div className="w-full max-w-lg rounded-3xl bg-[#141420] p-8 text-white shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-black">🎁 Your rewards</h2>
          <button
            onClick={onClose}
            className="rounded-lg bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10"
          >
            Close
          </button>
        </div>

        {promotions.length === 0 ? (
          <p className="py-6 text-center text-white/60">
            No rewards available right now. Keep visiting to earn more!
          </p>
        ) : (
          <ul className="space-y-3">
            {promotions.map((promo) => (
              <li
                key={promo.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4"
              >
                <div>
                  <p className="text-lg font-semibold">{promo.title}</p>
                  <p className="text-sm text-white/60">{promo.detail}</p>
                </div>
                <button
                  onClick={() => onAct(promo)}
                  disabled={busy}
                  className="shrink-0 rounded-xl bg-brand-500 px-5 py-3 text-base font-bold text-white hover:bg-brand-400 disabled:opacity-50"
                >
                  {actingId === promo.id ? '…' : promo.actionLabel}
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="mt-4 text-sm text-red-300">{error.message}</p>}
      </div>
    </div>
  )
}
