import type { Customer } from '../types'
import { useRedeemPoints, useClaimBirthday } from '../lib/queries'

// One eligible promotion the customer can act on right now. Multiple 'points'
// promos can coexist (one per active loyalty program), so each has a unique id.
export interface Promotion {
  id: string
  kind: 'points' | 'birthday'
  programId?: string // set for 'points' promos — which program to redeem
  title: string
  detail: string
  actionLabel: string
}

interface PromotionsModalProps {
  customer: Customer
  promotions: Promotion[]
  // Update the flow customer after an action so eligibility recomputes.
  onCustomerChange: (patch: Partial<Customer>) => void
  onClose: () => void
}

// Lists every promo the customer is eligible for — one per active loyalty
// program they can redeem, plus a birthday discount — each with its own action.
export function PromotionsModal({
  customer,
  promotions,
  onCustomerChange,
  onClose,
}: PromotionsModalProps) {
  const redeem = useRedeemPoints()
  const claim = useClaimBirthday()
  const currentYear = new Date().getFullYear()

  const onAct = async (promo: Promotion) => {
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
  }

  const busy = redeem.isPending || claim.isPending
  const error = redeem.error || claim.error

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
                  {busy ? '…' : promo.actionLabel}
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
