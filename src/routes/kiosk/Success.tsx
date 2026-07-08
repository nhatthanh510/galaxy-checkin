import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NextButton } from '../../components/NextButton'
import { useCreateCheckin, useActiveLoyaltyPrograms } from '../../lib/queries'
import { formatReward } from '../../lib/reward'
import { useKioskFlow } from './useKioskFlow'

const AUTO_RETURN_MS = 6000
// Linger a bit longer when we're showing the "you can redeem next time" reminder
// so the customer has time to read it.
const AUTO_RETURN_WITH_REMINDER_MS = 9000

type Status = 'submitting' | 'success' | 'error'

// Step 5: confirmation. Creates the checkin (status `waiting`) on mount. On
// success, shows the confirmation + points and auto-returns to the phone screen.
// On failure, shows a clear error with a Retry so the visit isn't silently lost.
export function Success() {
  const navigate = useNavigate()
  const flow = useKioskFlow()
  const createCheckin = useCreateCheckin()
  const { data: programs } = useActiveLoyaltyPrograms()
  const [status, setStatus] = useState<Status>('submitting')
  const [points, setPoints] = useState<number | null>(null)
  const submitted = useRef(false)

  // "You can redeem" reminder: after check-in, if the balance still clears a
  // points program's threshold, nudge the customer to redeem next visit. Pick the
  // LOWEST threshold they qualify for so the reminder is always relevant.
  const redeemableReward =
    points == null
      ? null
      : (programs ?? [])
          .filter((p) => p.triggerType === 'points' && p.pointsPerReward > 0 && points >= p.pointsPerReward)
          .sort((a, b) => a.pointsPerReward - b.pointsPerReward)[0] ?? null

  const runCheckin = () => {
    createCheckin
      .mutateAsync({
        phone: flow.phone,
        name: flow.customer?.name ?? flow.name,
        customerId: flow.customer?.id ?? null,
        serviceIds: flow.selectedServiceIds,
        birthday: flow.birthday,
        consent: flow.consent,
        // Redeeming a points reward this visit means no +1 is earned.
        awardPoint: !flow.pointsRedeemed,
      })
      .then((result) => {
        setPoints(result.customer.pointsBalance)
        setStatus('success')
      })
      .catch(() => setStatus('error'))
  }

  // Create the checkin exactly once on mount.
  useEffect(() => {
    if (submitted.current) return
    submitted.current = true
    // No phone means the flow was entered out of order — bail to the start.
    if (!flow.phone) {
      navigate('/', { replace: true })
      return
    }
    runCheckin()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Retry from the error screen: reset to submitting, then re-run.
  const retry = () => {
    setStatus('submitting')
    runCheckin()
  }

  // Auto-return only after a successful check-in.
  useEffect(() => {
    if (status !== 'success') return
    const t = setTimeout(() => {
      flow.reset()
      navigate('/', { replace: true })
    }, redeemableReward ? AUTO_RETURN_WITH_REMINDER_MS : AUTO_RETURN_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const startOver = () => {
    flow.reset()
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-[#0b0b12] px-8 text-center text-white">
      {status === 'submitting' && (
        <>
          <div className="h-20 w-20 animate-spin rounded-full border-4 border-white/20 border-t-white/70" />
          <p className="mt-8 text-2xl text-white/70">Checking you in…</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-emerald-500/20">
            <span className="text-7xl text-emerald-400">✓</span>
          </div>
          <h1 className="mt-8 text-4xl font-black tracking-wide">
            {flow.pointsRedeemed ? 'Reward redeemed — enjoy!' : 'You have checked in successfully!'}
          </h1>
          {points !== null && (
            <p className="mt-4 text-2xl text-white/70">
              {flow.pointsRedeemed ? 'Your balance is now ' : 'You have '}
              {points} points
            </p>
          )}
          {redeemableReward && (
            <div className="mt-6 rounded-2xl border border-brand-400/30 bg-brand-500/10 px-6 py-4">
              <p className="text-xl font-semibold text-brand-200">
                🎁 You have enough points for {formatReward(redeemableReward.rewardType, redeemableReward.rewardValue)}!
              </p>
              <p className="mt-1 text-base text-white/60">Redeem it on your next visit.</p>
            </div>
          )}
          <p className="mt-10 text-base text-white/40">Returning to the start…</p>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-red-500/20">
            <span className="text-7xl text-red-400">✕</span>
          </div>
          <h1 className="mt-8 text-4xl font-black tracking-wide">Something went wrong</h1>
          <p className="mt-4 text-xl text-white/60">
            We couldn't complete your check-in. Please try again or ask our staff.
          </p>
          <div className="mt-10 flex gap-4">
            <NextButton variant="ghost" onClick={startOver}>
              Start over
            </NextButton>
            <NextButton onClick={retry}>Try again</NextButton>
          </div>
        </>
      )}
    </div>
  )
}
