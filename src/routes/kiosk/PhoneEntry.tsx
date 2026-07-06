import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Keypad } from '../../components/Keypad'
import { LoyaltyCarousel } from '../../components/LoyaltyCarousel'
import { ConsentCheckbox } from '../../components/ConsentCheckbox'
import { NextButton } from '../../components/NextButton'
import { KioskLayout } from '../../components/KioskLayout'
import { RedeemModal } from '../../components/RedeemModal'
import {
  useCustomerLookup,
  useLoyaltyProgram,
  useActiveLoyaltyPrograms,
} from '../../lib/queries'
import type { Customer } from '../../types'
import { formatPhone, isComplete, isValidAuMobile, normalizePhone } from '../../lib/phone'
import { useKioskFlow } from './useKioskFlow'

// Step 1: phone entry (Australian mobiles). Known number -> greet + (maybe)
// redeem, skip to services. Unknown -> capture the name next. An invalid AU
// number warns but can be force-submitted ("Continue anyway").
export function PhoneEntry() {
  const navigate = useNavigate()
  const flow = useKioskFlow()
  const { data: program } = useLoyaltyProgram()
  const { data: activePrograms } = useActiveLoyaltyPrograms()
  const lookup = useCustomerLookup()
  // A known customer at/over the reward threshold — triggers the redeem modal.
  const [redeemFor, setRedeemFor] = useState<Customer | null>(null)
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

  const proceed = async () => {
    const customer = await lookup.mutateAsync(digits)
    flow.setCustomer(customer)
    if (!customer) {
      navigate('/kiosk/name')
      return
    }
    // Known customer at/over threshold -> prompt to redeem (with sound) before
    // continuing. Otherwise skip straight to services.
    if (program && customer.pointsBalance >= program.pointsPerReward) {
      setRedeemFor(customer)
    } else {
      navigate('/kiosk/services')
    }
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

  // After the redeem modal closes, persist the new balance (if redeemed) so the
  // later steps don't show the stale pre-redeem total, then continue the flow.
  const onRedeemClose = (result: { redeemed: boolean; newBalance?: number }) => {
    if (result.redeemed && result.newBalance != null && redeemFor) {
      flow.setCustomer({ ...redeemFor, pointsBalance: result.newBalance })
    }
    setRedeemFor(null)
    navigate('/kiosk/services')
  }

  return (
    // This screen drives its own initial redeem prompt, so suppress the shared
    // persistent banner here (it appears on the later steps instead).
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

          <Keypad onDigit={onDigit} onDelete={onDelete} />

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

      {redeemFor && program && (
        <RedeemModal customer={redeemFor} program={program} onClose={onRedeemClose} />
      )}
    </KioskLayout>
  )
}
