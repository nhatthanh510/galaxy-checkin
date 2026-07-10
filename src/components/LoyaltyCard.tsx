import type { LoyaltyProgram } from '../types'
import { useSettings } from '../lib/queries'
import { birthdayKioskBlurb } from '../lib/tier'

// The program info card, always visible on the phone-entry screen.
export function LoyaltyCard({ program }: { program: LoyaltyProgram }) {
  const { data: settings } = useSettings()
  const isBirthday = program.triggerType === 'date_window'

  // Birthday cards show the tier range (before a customer is identified, so no
  // single tier is known); other programs show their typed description.
  const detail = isBirthday
    ? birthdayKioskBlurb({
        new: settings?.birthdayPercentNew ?? 10,
        regular: settings?.birthdayPercentRegular ?? 15,
        vip: settings?.birthdayPercentVip ?? 20,
      })
    : program.description

  return (
    <div className="rounded-3xl bg-gradient-to-br from-brand-700/40 to-brand-600/20 border border-brand-400/30 p-8">
      <div className="text-5xl font-black text-brand-200">{program.name}</div>
      <div className="mt-3 text-2xl font-semibold text-white">{detail}</div>
      <p className="mt-6 text-base text-white/60">
        {isBirthday
          ? 'Visit more to reach Regular and VIP for a bigger birthday treat.'
          : 'Earn points on every visit and redeem them for money off your service.'}
      </p>
    </div>
  )
}
