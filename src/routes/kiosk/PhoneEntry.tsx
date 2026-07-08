import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Keypad } from '../../components/Keypad'
import { LoyaltyCarousel } from '../../components/LoyaltyCarousel'
import { ConsentCheckbox } from '../../components/ConsentCheckbox'
import { NextButton } from '../../components/NextButton'
import { KioskLayout } from '../../components/KioskLayout'
import { useCustomerLookup, useActiveLoyaltyPrograms } from '../../lib/queries'
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
    // Known customer -> services (rewards shown inline there). Unknown -> name.
    navigate(customer ? '/kiosk/services' : '/kiosk/name')
  }

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
  }, [digits, complete, valid, forcePrompted, lookup.isPending])

  return (
    // First step: no back arrow, and it drives its own rewards prompt so the
    // shared header link/banner is suppressed here.
    <KioskLayout showStartOver={false} showPromotions={false}>
      <div className="mx-auto grid w-full max-w-6xl min-h-0 flex-1 grid-cols-1 items-start gap-6 overflow-y-auto py-4 lg:grid-cols-2 lg:items-center lg:gap-10 lg:overflow-visible lg:py-0">
        {/* Left: loyalty program info card, always visible. */}
        <div className="order-2 lg:order-1">
          <LoyaltyCarousel programs={carouselPrograms} />
        </div>

        {/* Right: keypad + entry. */}
        <div className="order-1 lg:order-2">
          <h1 className="text-center text-3xl font-black tracking-wide text-white">
            PLEASE ENTER YOUR PHONE NUMBER
          </h1>

          <div className="my-6 flex h-16 items-center justify-center rounded-2xl bg-black/40 text-4xl font-semibold tracking-wider text-white">
            {formatPhone(digits) || (
              <span className="text-white/30">0400 000 000</span>
            )}
          </div>

          <Keypad onDigit={onDigit} onDelete={onDelete} onClear={onClear} />

          {/* Warn on an invalid AU mobile once the user has tried to continue. */}
          {complete && !valid && (
            <p className="mt-4 text-center text-lg text-amber-300">
              ⚠ That doesn't look like an Australian mobile (should start with 04).
            </p>
          )}

          <div className="mt-6">
            <NextButton
              onClick={onNext}
              disabled={!complete || lookup.isPending}
              className="w-full"
            >
              {lookup.isPending
                ? 'Checking…'
                : !valid && forcePrompted
                  ? 'Continue anyway'
                  : 'NEXT'}
            </NextButton>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-8 w-full max-w-6xl">
        <ConsentCheckbox checked={flow.consent} onChange={flow.setConsent} />
      </div>
    </KioskLayout>
  )
}
