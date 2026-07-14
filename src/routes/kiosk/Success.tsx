import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NextButton } from '../../components/NextButton'
import {
  useCreateCheckin,
  useRedeemPoints,
  useDeviceBranch,
  AlreadyCheckedInTodayError,
} from '../../lib/queries'
import { useEligiblePromotions } from '../../lib/useEligiblePromotions'
import { customerTier, tierBadgeKiosk } from '../../lib/tier'
import type { Customer } from '../../types'
import { useKioskFlow } from './useKioskFlow'
import { useConfirmUnload } from './useConfirmUnload'

// Auto-return delay once there's nothing left to decide (no rewards, or the
// reward was already taken). While a reward decision is still pending the timer
// doesn't run at all — see `decisionPending`.
const AUTO_RETURN_MS = 8000

type Status = 'submitting' | 'success' | 'already' | 'error'

// Step 5: confirmation. Creates the checkin (status `waiting`, +1 point) on
// mount, then — against the resulting balance — offers any reward the customer
// can now redeem/claim inline. Redeeming here sees today's point (a customer who
// arrives at 9 and needs 10 checks in to 10 and can redeem right away).
// Auto-returns to the phone screen after a resolved check-in.
export function Success() {
  const navigate = useNavigate()
  const flow = useKioskFlow()
  const createCheckin = useCreateCheckin()
  const redeem = useRedeemPoints()
  // This tablet's assigned branch (null when unassigned — check-in stays branchless).
  const { branch: deviceBranch } = useDeviceBranch()
  const [status, setStatus] = useState<Status>('submitting')
  // The customer as of after check-in — drives reward eligibility. Updated in
  // place after each redeem/claim so the offered rewards recompute.
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  // Whether the customer redeemed/claimed anything on this screen (copy only).
  const [redeemedAny, setRedeemedAny] = useState(false)
  const submitted = useRef(false)

  const name = customer?.name ?? flow.customer?.name ?? flow.name ?? null
  const points = customer?.pointsBalance ?? null

  // Warn before a refresh/close while the check-in is still being created — a
  // reload here would abandon it mid-request (the flow resets to the start and
  // never retries). Once it's resolved, a refresh is harmless.
  useConfirmUnload(status === 'submitting')

  // Rewards the customer can act on right now, from the post-check-in balance.
  const promotions = useEligiblePromotions(customer)

  const runCheckin = () => {
    createCheckin
      .mutateAsync({
        phone: flow.phone,
        name: flow.customer?.name ?? flow.name,
        customerId: flow.customer?.id ?? null,
        serviceIds: flow.selectedServiceIds,
        birthday: flow.birthday,
        consent: flow.consent,
        // Every check-in earns +1 — including visits where a reward is redeemed.
        awardPoint: true,
        // Stamp the visit with this tablet's branch (null when unassigned).
        branchId: deviceBranch?.id ?? null,
      })
      .then((result) => {
        // Build the post-check-in customer. For a KNOWN customer, keep their
        // stored birthday + birthdayRedeemedYear (create_checkin doesn't return
        // them) and overlay the fresh balances so birthday eligibility is right.
        const merged: Customer = flow.customer
          ? {
              ...flow.customer,
              name: result.customer.name,
              pointsBalance: result.customer.pointsBalance,
              lifetimePoints: result.customer.lifetimePoints,
              visitCount: result.customer.visitCount,
            }
          : result.customer
        setCustomer(merged)
        setStatus('success')
      })
      .catch((err) => {
        // Already visited today: a distinct, non-retryable friendly state.
        setStatus(err instanceof AlreadyCheckedInTodayError ? 'already' : 'error')
      })
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

  const onAct = async (programId: string, stampsYear: boolean) => {
    if (!customer) return
    setActingId(programId)
    try {
      const result = await redeem.mutateAsync({ customerId: customer.id, programId })
      setRedeemedAny(true)
      if (stampsYear) {
        // Birthday / standing claim: no balance change, mark the year claimed.
        setCustomer({ ...customer, birthdayRedeemedYear: new Date().getFullYear() })
      } else {
        // Points reward: balance dropped (the +1 earned this visit is kept).
        setCustomer({ ...customer, pointsBalance: result.pointsBalance })
      }
    } catch {
      // Leave the reward on offer to retry; error shown below.
    } finally {
      setActingId(null)
    }
  }

  // Seconds left before auto-returning to the start; null when the timer isn't
  // running (e.g. while a reward decision is still pending). Shown to staff so
  // the countdown isn't a surprise.
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  // When is there a reward DECISION still pending? While rewards are on offer and
  // the customer hasn't acted, staff may be talking it through — so DON'T run the
  // auto-return timer. It resumes once the reward is taken (redeemedAny) or there
  // was nothing to decide. This mirrors staff-assisted kiosks: the timeout is a
  // "customer walked away" safety net, not a hard deadline on an active choice.
  const decisionPending =
    status === 'success' && promotions.length > 0 && !redeemedAny

  // Auto-return after a resolved check-in, ticking down once a second. Skipped
  // while a decision is pending. All state updates happen inside the interval
  // callback (async) to keep the effect body free of synchronous setState.
  const resolved = status === 'success' || status === 'already'
  useEffect(() => {
    if (!resolved || decisionPending) return
    const deadline = performance.now() + AUTO_RETURN_MS
    const compute = () => {
      const remaining = Math.max(0, Math.ceil((deadline - performance.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining <= 0) {
        clearInterval(tick)
        flow.reset()
        navigate('/', { replace: true })
      }
    }
    // The first interval tick (within 250ms) paints the number; the effect body
    // itself performs no synchronous setState.
    const tick = setInterval(compute, 250)
    return () => clearInterval(tick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, decisionPending])

  const startOver = () => {
    flow.reset()
    navigate('/', { replace: true })
  }

  const busy = actingId != null

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
            {redeemedAny ? 'Reward redeemed — enjoy!' : 'You have checked in successfully!'}
          </h1>

          {/* Prominent customer card: name + current points balance, front and
              centre so the customer can confirm both at a glance. */}
          {(name || points !== null) && (
            <div className="mt-8 w-full max-w-md rounded-3xl border border-brand-400/40 bg-brand-500/10 px-8 py-6 shadow-lg shadow-brand-500/10">
              {name && (
                <div className="flex items-center justify-center gap-4">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-2xl font-black text-white">
                    {name.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-3xl font-bold text-white">{name}</span>
                </div>
              )}
              {customer && (
                <div className="mt-3 flex justify-center">
                  {(() => {
                    const badge = tierBadgeKiosk(customerTier(customer.lifetimePoints))
                    return (
                      <span className={`rounded-full px-4 py-1.5 text-lg font-bold ${badge.className}`}>
                        {badge.label} member
                      </span>
                    )
                  })()}
                </div>
              )}
              {points !== null && (
                <div className="mt-5 flex items-baseline justify-center gap-2">
                  <span className="text-5xl font-black text-brand-200">{points}</span>
                  <span className="text-2xl font-semibold text-white/70">
                    {points === 1 ? 'point' : 'points'}
                  </span>
                </div>
              )}
              {points !== null && (
                <p className="mt-1 text-center text-base text-white/50">
                  {redeemedAny ? 'Your new balance' : 'Your points balance'}
                </p>
              )}
            </div>
          )}

          {/* Redeemable rewards, offered against the post-check-in balance. Only
              ONE reward may be taken per visit — once the customer redeems or
              claims anything, the rest are locked. */}
          {promotions.length > 0 && (
            <div className="mt-6 w-full max-w-md space-y-3">
              <p className="text-lg font-semibold text-brand-200">
                🎁 {redeemedAny ? 'Reward applied' : 'Pick one reward'}
              </p>
              {promotions.map((promo) => (
                <div
                  key={promo.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-left"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-white">{promo.title}</p>
                      {promo.tierNote && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            promo.tierNoteClass ?? 'bg-white/10 text-white/60'
                          }`}
                        >
                          {promo.tierNote}
                        </span>
                      )}
                    </div>
                    {promo.highlight && (
                      <p className="mt-0.5 text-2xl font-black text-brand-300">
                        {promo.highlight}
                      </p>
                    )}
                    <p className="mt-0.5 text-sm text-white/60">{promo.detail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAct(promo.programId, promo.stampsYear)}
                    // One reward per visit: lock every button once one is taken.
                    disabled={busy || redeemedAny}
                    className="shrink-0 rounded-xl bg-brand-500 px-6 py-3 text-base font-bold text-white hover:bg-brand-400 disabled:opacity-50"
                  >
                    {actingId === promo.programId ? '…' : promo.actionLabel}
                  </button>
                </div>
              ))}
              {redeemedAny && (
                <p className="text-sm text-white/50">Just one reward per visit — enjoy!</p>
              )}
              {redeem.error && (
                <p className="text-sm text-red-300">{redeem.error.message}</p>
              )}
            </div>
          )}

          <div className="mt-8 flex flex-col items-center gap-3">
            <NextButton variant="ghost" onClick={startOver} disabled={busy}>
              Done
            </NextButton>
            {decisionPending ? (
              // Waiting on a reward decision — no countdown; staff/customer take
              // their time. Tapping Done (or redeeming) resumes the flow.
              <p className="text-base text-white/40">Take your time — tap Done when finished.</p>
            ) : (
              secondsLeft != null && (
                <p className="flex items-center gap-2 text-base text-white/50">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 font-bold tabular-nums text-white/80">
                    {secondsLeft}
                  </span>
                  Returning to the start…
                </p>
              )
            )}
          </div>
        </>
      )}

      {status === 'already' && (
        <>
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-amber-500/20">
            <span className="text-7xl text-amber-300">✓</span>
          </div>
          <h1 className="mt-8 text-4xl font-black tracking-wide">
            {name ? `You're already checked in today, ${name}!` : "You're already checked in today!"}
          </h1>
          <p className="mt-4 text-xl text-white/60">
            You can only check in once a day. Please see our staff if you need help.
          </p>
          {secondsLeft != null && (
            <p className="mt-10 flex items-center gap-2 text-base text-white/50">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 font-bold tabular-nums text-white/80">
                {secondsLeft}
              </span>
              Returning to the start…
            </p>
          )}
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
