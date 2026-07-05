import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useKioskFlow } from '../routes/kiosk/FlowContext'

interface KioskLayoutProps {
  children: ReactNode
  // Show a "Start over" affordance. Hidden on the phone-entry screen (already the start).
  showStartOver?: boolean
}

// Shared dark kiosk shell. Provides a persistent "Start over" path so no screen
// is a dead end, and resets flow state on the way out.
export function KioskLayout({ children, showStartOver = true }: KioskLayoutProps) {
  const navigate = useNavigate()
  const { reset } = useKioskFlow()

  const startOver = () => {
    reset()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-full flex flex-col bg-[#0b0b12] text-white">
      <header className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <span className="text-3xl">💅</span>
          <span className="text-xl font-semibold tracking-wide text-white/90">
            Galaxy Check-In
          </span>
        </div>
        {showStartOver && (
          <button
            type="button"
            onClick={startOver}
            className="rounded-xl bg-white/5 px-5 py-3 text-base font-medium text-white/70 hover:bg-white/10"
          >
            ↺ Start over
          </button>
        )}
      </header>
      <main className="flex-1 flex flex-col px-8 pb-10">{children}</main>
    </div>
  )
}
