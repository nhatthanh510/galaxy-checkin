import { useState } from 'react'
import type { LoyaltyProgram } from '../types'
import { LoyaltyCard } from './LoyaltyCard'

// Manual carousel of the active loyalty programs on the kiosk phone screen.
// No auto-rotate (accessibility) — arrows + dots only. Falls back to a single
// card (no controls) when there's just one program.
export function LoyaltyCarousel({ programs }: { programs: LoyaltyProgram[] }) {
  const [index, setIndex] = useState(0)

  if (programs.length === 0) return null
  const clamped = Math.min(index, programs.length - 1)
  const program = programs[clamped]
  const single = programs.length === 1

  const go = (delta: number) =>
    setIndex((i) => (i + delta + programs.length) % programs.length)

  return (
    <div>
      <div className="flex items-center gap-3">
        {!single && (
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous promotion"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/5 text-2xl text-white/80 hover:bg-white/15"
          >
            ‹
          </button>
        )}
        <div className="flex-1">
          <LoyaltyCard program={program} />
        </div>
        {!single && (
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next promotion"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/5 text-2xl text-white/80 hover:bg-white/15"
          >
            ›
          </button>
        )}
      </div>

      {!single && (
        <div className="mt-4 flex justify-center gap-2">
          {programs.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Go to promotion ${i + 1}`}
              aria-current={i === clamped}
              className={
                'h-3 rounded-full transition-all ' +
                (i === clamped ? 'w-8 bg-brand-400' : 'w-3 bg-white/25 hover:bg-white/40')
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
