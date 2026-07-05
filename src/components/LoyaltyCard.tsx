import type { LoyaltyProgram } from '../types'

// The program info card, always visible on the phone-entry screen.
export function LoyaltyCard({ program }: { program: LoyaltyProgram }) {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-brand-700/40 to-brand-600/20 border border-brand-400/30 p-8">
      <div className="text-5xl font-black text-brand-200">{program.name}</div>
      <div className="mt-3 text-2xl font-semibold text-white">{program.description}</div>
      <p className="mt-6 text-base text-white/60">
        Earn points on every visit and redeem them for money off your service.
      </p>
    </div>
  )
}
