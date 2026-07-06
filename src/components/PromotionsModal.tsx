import type { Customer, LoyaltyProgram } from '../types'
import { useRedeemPoints, useClaimBirthday } from '../lib/queries'

// One eligible promotion the customer can act on right now.
export interface Promotion {
  key: 'points' | 'birthday'
  title: string
  detail: string
  actionLabel: string
}

interface PromotionsModalProps {
  customer: Customer
  program: LoyaltyProgram | null
  promotions: Promotion[]
  // Update the flow customer after an action so eligibility recomputes.
  onCustomerChange: (patch: Partial<Customer>) => void
  onClose: () => void
}

// Lists every promo the customer is eligible for (points redeem, birthday
// discount, …) with a per-promo action. Unifies the previously-separate points
// banner and birthday reminder into one place.
export function PromotionsModal({
  customer,
  program,
  promotions,
  onCustomerChange,
  onClose,
}: PromotionsModalProps) {
  const redeem = useRedeemPoints()
  const claim = useClaimBirthday()
  const currentYear = new Date().getFullYear()

  const onRedeemPoints = async () => {
    const result = await redeem.mutateAsync(customer.id)
    onCustomerChange({ pointsBalance: result.pointsBalance })
  }

  const onClaimBirthday = async () => {
    await claim.mutateAsync(customer.id)
    onCustomerChange({ birthdayRedeemedYear: currentYear })
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
                key={promo.key}
                className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4"
              >
                <div>
                  <p className="text-lg font-semibold">{promo.title}</p>
                  <p className="text-sm text-white/60">{promo.detail}</p>
                </div>
                <button
                  onClick={promo.key === 'points' ? onRedeemPoints : onClaimBirthday}
                  disabled={busy || (promo.key === 'points' && program == null)}
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
