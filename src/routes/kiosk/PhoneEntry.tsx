import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Keypad } from '../../components/Keypad'
import { LoyaltyCarousel } from '../../components/LoyaltyCarousel'
import { ConsentCheckbox } from '../../components/ConsentCheckbox'
import { NextButton } from '../../components/NextButton'
import { KioskLayout } from '../../components/KioskLayout'
import {
  useCustomerLookup,
  useCheckedInToday,
  useActiveLoyaltyPrograms,
} from '../../lib/queries'
import { formatPhone, isComplete, isValidAuMobile, normalizePhone } from '../../lib/phone'
import { useKioskFlow } from './useKioskFlow'

// Step 1: phone entry (Australian mobiles). Known number -> services (rewards are
// shown in-context there, no interrupting popup). Unknown -> capture the name.
// An invalid AU number warns but can be force-submitted ("Continue anyway").
export function PhoneEntry() {
  const navigate = useNavigate()
  const flow = useKioskFlow()
  const { data: activePrograms } = useActiveLoyaltyPrograms()
  const lookup = useCustomerLookup()
  const checkedInToday = useCheckedInToday()
  // Set when a returning customer has already checked in today — the flow is
  // one visit per day, so we stop them here instead of letting them redeem a
  // reward on a visit that would then be rejected. Holds their name for a warm
  // message; the panel auto-dismisses so the kiosk is ready for the next person.
  const [alreadyName, setAlreadyName] = useState<string | null>(null)

  // Show points programs first in the carousel (birthday/standing promos after),
  // keeping the query's name order within each group.
  const carouselPrograms = useMemo(
    () =>
      [...(activePrograms ?? [])].sort(
        (a, b) => Number(b.triggerType === 'points') - Number(a.triggerType === 'points'),
      ),
    [activePrograms],
  )
  // Set once the user has tried to submit an invalid number, so the button
  // switches to "Continue anyway" (force-process).
  const [forcePrompted, setForcePrompted] = useState(false)

  const digits = flow.phone
  const complete = isComplete(digits)
  const valid = isValidAuMobile(digits)

  const onDigit = (d: string) => {
    setForcePrompted(false)
    flow.setPhone(normalizePhone(digits + d))
  }
  const onDelete = () => {
    setForcePrompted(false)
    flow.setPhone(digits.slice(0, -1))
  }
  const onClear = () => {
    setForcePrompted(false)
    flow.setPhone('')
  }

  const proceed = async () => {
    const customer = await lookup.mutateAsync(digits)
    flow.setCustomer(customer)
    // Unknown number -> capture the name. (A brand-new customer can't have a
    // visit today yet, so no need to check.)
    if (!customer) {
      navigate('/kiosk/name')
      return
    }
    // Known customer: enforce one check-in per day before entering the flow.
    if (await checkedInToday.mutateAsync(customer.id)) {
      setAlreadyName(customer.name)
      return
    }
    // Otherwise on to services (rewards are shown inline there).
    navigate('/kiosk/services')
  }

  // Dismiss the "already checked in" panel and reset for the next person.
  const dismissAlready = () => {
    setAlreadyName(null)
    flow.reset()
  }

  // Auto-dismiss the panel so the kiosk returns to a clean phone screen.
  useEffect(() => {
    if (alreadyName == null) return
    const t = setTimeout(dismissAlready, 6000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alreadyName])

  const onNext = async () => {
    if (!complete) return
    // Valid AU mobile -> proceed. Invalid -> first tap warns and arms the
    // override; second tap ("Continue anyway") force-processes.
    if (valid || forcePrompted) {
      await proceed()
    } else {
      setForcePrompted(true)
    }
  }

  // Physical keyboard support: number keys type digits, Backspace/Delete removes
  // the last one, Enter submits, Escape clears. Mirrors the on-screen Keypad so a
  // USB/Bluetooth keyboard works alongside the tablet's touch keypad.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore while the "already checked in" panel is up (no keypad shown).
      if (alreadyName != null) return
      // Ignore when typing into a field or when a modifier is held.
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        onDigit(e.key)
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        onDelete()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        void onNext()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClear()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // Re-bind when the values the handlers close over change, so onNext sees the
    // current digits/valid/forcePrompted state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits, complete, valid, forcePrompted, lookup.isPending, alreadyName])

  // Returning customer who already checked in today: a full-screen, self-
  // dismissing message instead of the keypad.
  if (alreadyName != null) {
    return (
      <KioskLayout showStartOver={false}>
        <div className="flex min-h-full flex-col items-center justify-center px-8 text-center text-white">
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-amber-500/20">
            <span className="text-7xl text-amber-300">✓</span>
          </div>
          <h1 className="mt-8 text-4xl font-black tracking-wide">
            You're already checked in today, {alreadyName}!
          </h1>
          <p className="mt-4 text-xl text-white/60">
            You can only check in once a day. Please see our staff if you need help.
          </p>
          <div className="mt-10">
            <NextButton onClick={dismissAlready} className="w-full max-w-sm">
              Done
            </NextButton>
          </div>
        </div>
      </KioskLayout>
    )
  }

  const busy = lookup.isPending || checkedInToday.isPending

  return (
    // First step: no back arrow, and it drives its own rewards prompt so the
    // shared header link/banner is suppressed here.
    <KioskLayout showStartOver={false}>
      <div className="mx-auto grid w-full max-w-6xl min-h-0 flex-1 grid-cols-1 items-start gap-6 overflow-y-auto py-4 lg:grid-cols-2 lg:items-center lg:gap-10 lg:overflow-visible lg:py-0">
        {/* Left: loyalty program info card, always visible. */}
        <div className="order-2 lg:order-1">
          <LoyaltyCarousel programs={carouselPrograms} />
        </div>

        {/* Right: keypad + entry. */}
        <div className="order-1 lg:order-2">
          <h1 className="text-center text-2xl font-black tracking-wide text-white sm:text-3xl short-desktop:text-2xl">
            PLEASE ENTER YOUR PHONE NUMBER
          </h1>

          <div className="my-4 flex h-14 items-center justify-center rounded-2xl bg-black/40 text-3xl font-semibold tracking-wider text-white sm:my-6 sm:h-16 sm:text-4xl short-desktop:my-3 short-desktop:h-14">
            {formatPhone(digits) || (
              <span className="text-white/30">0400 000 000</span>
            )}
          </div>

          <Keypad onDigit={onDigit} onDelete={onDelete} onClear={onClear} />

          {/* Warn on an invalid AU mobile once the user has tried to continue. */}
          {complete && !valid && (
            <p className="mt-4 text-center text-lg text-amber-300 short-desktop:mt-2 short-desktop:text-base">
              ⚠ That doesn't look like an Australian mobile (should start with 04).
            </p>
          )}

          <div className="mt-4 sm:mt-6 short-desktop:mt-3">
            <NextButton
              onClick={onNext}
              disabled={!complete || busy}
              className="w-full"
            >
              {busy
                ? 'Checking…'
                : !valid && forcePrompted
                  ? 'Continue anyway'
                  : 'NEXT'}
            </NextButton>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-8 w-full max-w-6xl short-desktop:mt-3">
        <ConsentCheckbox checked={flow.consent} onChange={flow.setConsent} />
      </div>
    </KioskLayout>
  )
}
