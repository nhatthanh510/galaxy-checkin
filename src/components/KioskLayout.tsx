import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useKioskFlow } from '../routes/kiosk/useKioskFlow'
import { useRefreshCustomerOnFocus } from '../routes/kiosk/useRefreshCustomerOnFocus'
import { useAuth } from '../lib/auth/useAuth'
import { useDeviceBranch } from '../lib/queries'

interface KioskLayoutOptions {
  showStartOver?: boolean
}

interface KioskLayoutProps extends KioskLayoutOptions {
  children: ReactNode
}

// Shared dark kiosk shell. Provides a persistent "Start over" path so no screen
// is a dead end, and resets flow state on the way out. Steps render their own
// back arrow (BackButton) next to their title. Rewards are offered on the
// success screen (after check-in), not from this shell.
export function KioskLayout({ children, showStartOver = true }: KioskLayoutProps) {
  const navigate = useNavigate()
  const { reset } = useKioskFlow()
  const { isAdmin, signOut } = useAuth()
  // This tablet's assigned branch — shown to staff so it's clear where check-ins
  // are being recorded, with a link to re-assign. Null = unassigned (branchless).
  const { branch: deviceBranch } = useDeviceBranch()

  // Reflect external redeems (e.g. from the admin side) on the active kiosk
  // customer when the tab regains focus.
  useRefreshCustomerOnFocus()

  const startOver = () => {
    reset()
    navigate('/', { replace: true })
  }

  const onSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  // This tablet's branch chip. Read-only for staff; only an admin can change it
  // (admin-gated setup screen). The branch NAME is highlighted so it stands out.
  const branchChip = isAdmin ? (
    <Link
      to="/kiosk/setup"
      className="inline-flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-1.5 text-sm font-medium text-white/60 hover:bg-white/10"
      title="Set which branch this tablet is at (admin)"
    >
      <BranchLabel name={deviceBranch?.name ?? null} />
      <span className="text-white/30">· change</span>
    </Link>
  ) : (
    <span
      className="inline-flex items-center rounded-xl bg-white/5 px-3 py-1.5 text-sm font-medium text-white/60"
      title="This tablet's branch"
    >
      <BranchLabel name={deviceBranch?.name ?? null} />
    </span>
  )

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#0b0b12] text-white">
      <header className="px-4 py-3 sm:px-8 sm:py-5">
        {/* Top row: logo + (branch on sm+) + Start over / Admin / Sign out. */}
        <div className="flex items-center justify-between gap-2">
          {/* Logo sits on a light chip so the dark-brown mark stays readable on
              the near-black kiosk header. */}
          <div className="shrink-0 rounded-xl bg-white px-3 py-1.5 sm:px-4 sm:py-2">
            <img src="/logo.png" alt="Galaxy Nails" className="h-6 w-auto sm:h-8" />
          </div>
          <div className="flex items-center justify-end gap-2 sm:gap-3">
            {/* Branch is inline here on tablet/desktop; on mobile it moves to its
                own row below (see mobile-only block). */}
            <div className="hidden min-w-0 sm:block">{branchChip}</div>
            {showStartOver && (
              <button
                type="button"
                onClick={startOver}
                className="shrink-0 rounded-xl bg-white/5 px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/10 sm:px-5 sm:py-3 sm:text-base"
              >
                ↺ <span className="hidden sm:inline">Start over</span>
              </button>
            )}
            {isAdmin && (
              <Link
                to="/admin"
                className="shrink-0 rounded-xl bg-white/5 px-3 py-2 text-sm font-medium text-brand-200 hover:bg-white/10 sm:px-4 sm:py-3 sm:text-base"
              >
                Admin
              </Link>
            )}
            <button
              type="button"
              onClick={onSignOut}
              className="shrink-0 rounded-xl px-2 py-2 text-sm font-medium text-white/40 hover:text-white/70 sm:px-3 sm:py-3"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Mobile only: branch on its own line under the logo. */}
        <div className="mt-2 flex sm:hidden">{branchChip}</div>
      </header>
      <main className="min-h-0 flex-1 flex flex-col px-4 pb-10 sm:px-8">{children}</main>
    </div>
  )
}

// "📍 This tablet: <branch>" with the branch NAME highlighted so it stands out.
// Shows a muted "Not set" when the tablet has no branch assigned.
function BranchLabel({ name }: { name: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden>📍</span>
      {name ? (
        <span className="rounded-md bg-brand-500/20 px-2 py-0.5 font-semibold text-brand-200">
          {name}
        </span>
      ) : (
        <span className="text-white/40">Not set</span>
      )}
    </span>
  )
}
