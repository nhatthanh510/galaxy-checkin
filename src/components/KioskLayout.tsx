import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useKioskFlow } from '../routes/kiosk/useKioskFlow'
import { PromotionsLink } from './PromotionsLink'

interface KioskLayoutOptions {
  showStartOver?: boolean
  // Show the unified "rewards available" promotions link (when the identified
  // customer is eligible for any promo). Off on the phone-entry screen, which
  // drives its own initial redeem prompt.
  showPromotions?: boolean
}

interface KioskLayoutProps extends KioskLayoutOptions {
  children: ReactNode
}

// Shared dark kiosk shell. Provides a persistent "Start over" path so no screen
// is a dead end, and resets flow state on the way out.
export function KioskLayout({
  children,
  showStartOver = true,
  showPromotions = true,
}: KioskLayoutProps) {
  const navigate = useNavigate()
  const { reset } = useKioskFlow()

  const startOver = () => {
    reset()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-full flex flex-col bg-[#0b0b12] text-white">
      <header className="flex items-center justify-between px-8 py-5">
        {/* Logo sits on a light chip so the dark-brown mark stays readable on
            the near-black kiosk header. */}
        <div className="rounded-xl bg-white px-4 py-2">
          <img src="/logo.png" alt="Galaxy Nails" className="h-8 w-auto" />
        </div>
        <div className="flex items-center gap-5">
          {/* Unified rewards link (only shows when any promo is eligible). */}
          {showPromotions && <PromotionsLink />}
          {showStartOver && (
            <button
              type="button"
              onClick={startOver}
              className="rounded-xl bg-white/5 px-5 py-3 text-base font-medium text-white/70 hover:bg-white/10"
            >
              ↺ Start over
            </button>
          )}
        </div>
      </header>
      <main className="flex-1 flex flex-col px-8 pb-10">{children}</main>
    </div>
  )
}
