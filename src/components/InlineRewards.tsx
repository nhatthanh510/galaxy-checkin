import { useState } from 'react'
import type { Customer } from '../types'
import { useRedeemPoints, useClaimBirthday } from '../lib/queries'
import { useEligiblePromotions } from '../lib/useEligiblePromotions'
import type { Promotion } from './PromotionsModal'

interface InlineRewardsProps {
  customer: Customer
  // Apply a patch to the flow customer after an action (so eligibility + later
  // steps recompute).
  onCustomerChange: (patch: Partial<Customer>) => void
}

// In-context rewards panel for the kiosk services screen — one action per
// eligible promo (redeem points, claim birthday). No interrupting popup: the
// customer sees and acts on rewards right where they are. Hidden when none.
export function InlineRewards({ customer, onCustomerChange }: InlineRewardsProps) {
  const promotions = useEligiblePromotions(customer)
  const redeem = useRedeemPoints()
  const claim = useClaimBirthday()
  const currentYear = new Date().getFullYear()
  // Which promo is currently being acted on — so only that button shows loading.
  const [actingId, setActingId] = useState<string | null>(null)

  const onAct = async (promo: Promotion) => {
    setActingId(promo.id)
    try {
      if (promo.kind === 'points') {
        const result = await redeem.mutateAsync({
          customerId: customer.id,
          programId: promo.programId ?? null,
        })
        onCustomerChange({ pointsBalance: result.pointsBalance })
      } else {
        await claim.mutateAsync(customer.id)
        onCustomerChange({ birthdayRedeemedYear: currentYear })
      }
    } finally {
      setActingId(null)
    }
  }

  // Early-return AFTER all hooks (rules of hooks).
  if (promotions.length === 0) return null

  const busy = actingId != null
  const error = redeem.error || claim.error

  return (
    <div className="mt-4 rounded-2xl border border-brand-400/30 bg-brand-500/10 p-5">
      <p className="mb-3 text-lg font-bold text-brand-200">🎁 Rewards available</p>
      <div className="space-y-3">
        {promotions.map((promo) => (
          <div
            key={promo.id}
            className="flex items-center justify-between gap-4 rounded-xl bg-white/5 px-4 py-3"
          >
            <div>
              <p className="font-semibold text-white">{promo.title}</p>
              <p className="text-sm text-white/60">{promo.detail}</p>
            </div>
            <button
              type="button"
              onClick={() => onAct(promo)}
              disabled={busy}
              className="shrink-0 rounded-xl bg-brand-500 px-5 py-2.5 text-base font-bold text-white hover:bg-brand-400 disabled:opacity-50"
            >
              {actingId === promo.id ? '…' : promo.actionLabel}
            </button>
          </div>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-300">{error.message}</p>}
    </div>
  )
}
