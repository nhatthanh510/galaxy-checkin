import { useState } from 'react'
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

  return (
    // First step: no back arrow, and it drives its own rewards prompt so the
    // shared header link/banner is suppressed here.
    <KioskLayout showStartOver={false} showPromotions={false}>
      <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-10 lg:grid-cols-2">
        {/* Left: loyalty program info card, always visible. */}
        <div className="order-2 lg:order-1">
          <LoyaltyCarousel programs={activePrograms ?? []} />
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
