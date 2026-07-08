import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NextButton } from '../../components/NextButton'
import { KioskLayout } from '../../components/KioskLayout'
import { BackButton } from '../../components/BackButton'
import { useRedeemPoints } from '../../lib/queries'
import { useEligiblePromotions } from '../../lib/useEligiblePromotions'
import type { Promotion } from '../../components/PromotionsModal'
import { useKioskFlow } from './useKioskFlow'

// Step 4: rewards. Shown AFTER services and BEFORE success, only when the
// customer is eligible for something (ServiceSelection skips straight to success
// otherwise). Redeeming/claiming here happens before check-in, so a redeemed
// POINTS reward can suppress this visit's +1 point (flow.pointsRedeemed), while a
// birthday/standing claim leaves the point intact.
export function RewardStep() {
  const navigate = useNavigate()
  const flow = useKioskFlow()
  const customer = flow.customer
  const promotions = useEligiblePromotions(customer)
  const redeem = useRedeemPoints()
  const currentYear = new Date().getFullYear()
  const [actingId, setActingId] = useState<string | null>(null)

  const goSuccess = () => navigate('/kiosk/success')

  const onAct = async (promo: Promotion) => {
    if (!customer) return
    setActingId(promo.id)
    try {
      const result = await redeem.mutateAsync({
        customerId: customer.id,
        programId: promo.programId,
      })
      if (promo.stampsYear) {
        // Non-points claim (birthday / standing): stamps the year, no points
        // change, and the +1 check-in point is still earned.
        flow.setCustomer({ ...customer, birthdayRedeemedYear: currentYear })
      } else {
        // Points reward: balance dropped now, and this visit must not earn +1.
        flow.setCustomer({ ...customer, pointsBalance: result.pointsBalance })
        flow.setPointsRedeemed(true)
      }
      goSuccess()
    } catch {
      // Leave the customer on the step to retry; error shown below.
    } finally {
      setActingId(null)
    }
  }

  // Guard: reached out of order (no customer / nothing eligible) — go on.
  if (!customer || promotions.length === 0) {
    goSuccess()
    return null
  }

  const busy = actingId != null

  return (
    <KioskLayout>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center">
        <div className="flex items-center gap-4">
          <BackButton />
          <h1 className="flex-1 text-center text-4xl font-black tracking-wide text-white">
            🎁 YOUR REWARDS
          </h1>
          <div className="h-12 w-12 shrink-0" aria-hidden />
        </div>
        <p className="mt-3 text-center text-xl text-white/60">
          {customer.name}, you have{' '}
          <span className="font-bold text-brand-300">{customer.pointsBalance}</span>{' '}
          {customer.pointsBalance === 1 ? 'point' : 'points'}.
        </p>

        <div className="mt-8 space-y-3">
          {promotions.map((promo) => (
            <div
              key={promo.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-5"
            >
              <div>
                <p className="text-xl font-semibold text-white">{promo.title}</p>
                <p className="text-base text-white/60">{promo.detail}</p>
              </div>
              <button
                type="button"
                onClick={() => onAct(promo)}
                disabled={busy}
                className="shrink-0 rounded-xl bg-brand-500 px-7 py-4 text-lg font-bold text-white hover:bg-brand-400 disabled:opacity-50"
              >
                {actingId === promo.id ? '…' : promo.actionLabel}
              </button>
            </div>
          ))}
        </div>

        {redeem.error && (
          <p className="mt-4 text-center text-base text-red-300">{redeem.error.message}</p>
        )}

        <div className="mt-10 flex justify-center">
          <NextButton variant="ghost" onClick={goSuccess} disabled={busy} className="w-full max-w-sm">
            No thanks, continue
          </NextButton>
        </div>
      </div>
    </KioskLayout>
  )
}
