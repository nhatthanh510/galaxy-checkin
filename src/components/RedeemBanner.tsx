import { useState } from 'react'
import { useLoyaltyProgram } from '../lib/queries'
import { useKioskFlow } from '../routes/kiosk/useKioskFlow'
import { RedeemModal } from './RedeemModal'

// Persistent redeem entry point shown on every kiosk step (via KioskLayout) once
// a known customer is identified and is at/over the reward threshold. Lets a
// customer who dismissed the initial prompt still redeem at any point before
// finishing. Hidden once they no longer qualify (e.g. after redeeming).
export function RedeemBanner() {
  const flow = useKioskFlow()
  const { data: program } = useLoyaltyProgram()
  const [open, setOpen] = useState(false)

  const customer = flow.customer
  const eligible =
    customer != null &&
    program != null &&
    customer.pointsBalance >= program.pointsPerReward

  if (!eligible || !customer || !program) return null

  return (
    <>
      {/* Small, unobtrusive link — not a full-width banner. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-300 hover:text-emerald-200 hover:underline"
      >
        🎁 Redeem {program.pointsPerReward} points for ${program.rewardAmount} off
      </button>

      {open && (
        <RedeemModal
          customer={customer}
          program={program}
          onClose={(result) => {
            setOpen(false)
            // Reflect the new balance so the banner recomputes eligibility
            // (and hides itself if they've dropped below the threshold).
            if (result.redeemed && result.newBalance != null) {
              flow.setCustomer({ ...customer, pointsBalance: result.newBalance })
            }
          }}
        />
      )}
    </>
  )
}
