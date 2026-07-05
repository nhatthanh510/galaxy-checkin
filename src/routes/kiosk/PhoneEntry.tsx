import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Keypad } from '../../components/Keypad'
import { LoyaltyCard } from '../../components/LoyaltyCard'
import { ConsentCheckbox } from '../../components/ConsentCheckbox'
import { NextButton } from '../../components/NextButton'
import { KioskLayout } from '../../components/KioskLayout'
import { useCustomerLookup, useLoyaltyProgram } from '../../lib/queries'
import { formatPhone, isCompletePhone, normalizePhone } from '../../lib/phone'
import { useKioskFlow } from './FlowContext'

// Step 1: phone entry. Known number -> greet + (maybe) redeem reminder, skip to
// services. Unknown -> capture the name next.
export function PhoneEntry() {
  const navigate = useNavigate()
  const flow = useKioskFlow()
  const { data: program } = useLoyaltyProgram()
  const lookup = useCustomerLookup()
  const [consent, setConsent] = useState(false)

  const digits = flow.phone
  const complete = isCompletePhone(digits)

  const onDigit = (d: string) => flow.setPhone(normalizePhone(digits + d))
  const onDelete = () => flow.setPhone(digits.slice(0, -1))

  const onNext = async () => {
    if (!complete) return
    const customer = await lookup.mutateAsync(digits)
    flow.setCustomer(customer)
    if (customer) {
      // Known customer: skip the name step, go straight to services.
      navigate('/kiosk/services')
    } else {
      navigate('/kiosk/name')
    }
  }

  return (
    <KioskLayout showStartOver={false}>
      <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-10 lg:grid-cols-2">
        {/* Left: loyalty program info card, always visible. */}
        <div className="order-2 lg:order-1">
          {program && <LoyaltyCard program={program} />}
        </div>

        {/* Right: keypad + entry. */}
        <div className="order-1 lg:order-2">
          <h1 className="text-center text-3xl font-black tracking-wide text-white">
            PLEASE ENTER YOUR PHONE NUMBER
          </h1>

          <div className="my-6 flex h-16 items-center justify-center rounded-2xl bg-black/40 text-4xl font-semibold tracking-wider text-white">
            {formatPhone(digits) || <span className="text-white/30">(___) ___-____</span>}
          </div>

          <Keypad onDigit={onDigit} onDelete={onDelete} />

          <div className="mt-8">
            <NextButton
              onClick={onNext}
              disabled={!complete || lookup.isPending}
              className="w-full"
            >
              {lookup.isPending ? 'Checking…' : 'NEXT'}
            </NextButton>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-8 w-full max-w-6xl">
        <ConsentCheckbox checked={consent} onChange={setConsent} />
      </div>
    </KioskLayout>
  )
}
