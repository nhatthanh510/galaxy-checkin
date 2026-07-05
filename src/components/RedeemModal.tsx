import { useEffect, useState } from 'react'
import type { Customer, LoyaltyProgram } from '../types'
import { useRedeemPoints } from '../lib/queries'
import { playChime } from '../lib/sound'

export interface RedeemCloseResult {
  redeemed: boolean
  newBalance?: number // present when redeemed — the post-redeem points balance
}

interface RedeemModalProps {
  customer: Customer
  program: LoyaltyProgram
  onClose: (result: RedeemCloseResult) => void
}

// Kiosk redeem prompt: appears when a returning customer is at/over the reward
// threshold. Plays a chime on mount to grab attention. On redeem, calls the
// redeem_points RPC (subtracts the threshold) and reports the new balance back.
export function RedeemModal({ customer, program, onClose }: RedeemModalProps) {
  const redeem = useRedeemPoints()
  const [done, setDone] = useState(false)

  // Attention chime on mount.
  useEffect(() => {
    playChime()
  }, [])

  const onRedeem = async () => {
    try {
      const result = await redeem.mutateAsync(customer.id)
      setDone(true)
      // Brief confirmation, then close, reporting the new balance.
      setTimeout(() => onClose({ redeemed: true, newBalance: result.pointsBalance }), 1600)
    } catch {
      // Error is surfaced below; leave the modal open.
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <div className="w-full max-w-lg rounded-3xl bg-gradient-to-br from-brand-800 to-brand-700 p-10 text-center text-white shadow-2xl">
        {done ? (
          <>
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white/15">
              <span className="text-6xl">🎉</span>
            </div>
            <h2 className="mt-6 text-3xl font-black">Reward redeemed!</h2>
            <p className="mt-2 text-lg text-white/80">
              ${program.rewardAmount} off — enjoy your visit.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white/15">
              <span className="text-6xl">🎁</span>
            </div>
            <h2 className="mt-6 text-3xl font-black">You have {customer.pointsBalance} points!</h2>
            <p className="mt-3 text-xl text-white/85">
              Redeem {program.pointsPerReward} points for ${program.rewardAmount} off your
              service?
            </p>

            {redeem.error && (
              <p className="mt-4 text-sm text-red-200">{redeem.error.message}</p>
            )}

            <div className="mt-8 flex gap-4">
              <button
                onClick={() => onClose({ redeemed: false })}
                disabled={redeem.isPending}
                className="flex-1 rounded-2xl bg-white/10 py-4 text-lg font-semibold text-white/80 hover:bg-white/20 disabled:opacity-50"
              >
                Maybe later
              </button>
              <button
                onClick={onRedeem}
                disabled={redeem.isPending}
                className="flex-1 rounded-2xl bg-white py-4 text-lg font-bold text-brand-800 hover:bg-white/90 disabled:opacity-50"
              >
                {redeem.isPending ? 'Redeeming…' : 'Redeem now'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
