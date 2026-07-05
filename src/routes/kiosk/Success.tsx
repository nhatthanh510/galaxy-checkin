import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateCheckin } from '../../lib/queries'
import { useKioskFlow } from './useKioskFlow'

const AUTO_RETURN_MS = 6000

// Step 5: confirmation. Creates the checkin (status `waiting`) on mount, shows
// the customer's points, then auto-returns to the phone screen for the next
// person. Guards against creating the checkin twice (React strict-mode / re-render).
export function Success() {
  const navigate = useNavigate()
  const flow = useKioskFlow()
  const createCheckin = useCreateCheckin()
  const [points, setPoints] = useState<number | null>(null)
  const submitted = useRef(false)

  // Create the checkin exactly once.
  useEffect(() => {
    if (submitted.current) return
    submitted.current = true

    // No phone means the flow was entered out of order (e.g. deep link) — bail
    // to the start rather than creating a bogus checkin.
    if (!flow.phone) {
      navigate('/', { replace: true })
      return
    }

    createCheckin
      .mutateAsync({
        phone: flow.phone,
        name: flow.customer?.name ?? flow.name,
        customerId: flow.customer?.id ?? null,
        serviceIds: flow.selectedServiceIds,
        technicianId: flow.technicianId,
      })
      .then((result) => setPoints(result.customer.pointsBalance))
      .catch(() => setPoints(flow.customer?.pointsBalance ?? 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-return to the phone-entry screen and reset the flow.
  useEffect(() => {
    const t = setTimeout(() => {
      flow.reset()
      navigate('/', { replace: true })
    }, AUTO_RETURN_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-[#0b0b12] px-8 text-center text-white">
      <div className="flex h-32 w-32 items-center justify-center rounded-full bg-emerald-500/20">
        <span className="text-7xl text-emerald-400">✓</span>
      </div>
      <h1 className="mt-8 text-4xl font-black tracking-wide">
        You have checked in successfully!
      </h1>
      {points !== null && (
        <p className="mt-4 text-2xl text-white/70">You had {points} points</p>
      )}
      <p className="mt-10 text-base text-white/40">Returning to the start…</p>
    </div>
  )
}
