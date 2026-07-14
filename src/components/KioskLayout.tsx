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

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#0b0b12] text-white">
      <header className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 px-4 py-3 sm:px-8 sm:py-5">
        {/* Logo sits on a light chip so the dark-brown mark stays readable on
            the near-black kiosk header. */}
        <div className="rounded-xl bg-white px-3 py-1.5 sm:px-4 sm:py-2">
          <img src="/logo.png" alt="Galaxy Nails" className="h-6 w-auto sm:h-8" />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
          {showStartOver && (
            <button
              type="button"
              onClick={startOver}
              className="rounded-xl bg-white/5 px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/10 sm:px-5 sm:py-3 sm:text-base"
            >
              ↺ Start over
            </button>
          )}
          {/* This tablet's branch. Read-only for staff; only an admin can change
              it (links to the admin-gated setup screen). "Not set" when
              unassigned — check-ins stay branchless. */}
          {isAdmin ? (
            <Link
              to="/kiosk/setup"
              className="rounded-xl bg-white/5 px-3 py-2 text-xs font-medium text-white/50 hover:bg-white/10 sm:text-sm"
              title="Set which branch this tablet is at (admin)"
            >
              📍 {deviceBranch ? deviceBranch.name : 'Not set'}
              <span className="ml-1 text-white/30">· change</span>
            </Link>
          ) : (
            <span
              className="rounded-xl bg-white/5 px-3 py-2 text-xs font-medium text-white/50 sm:text-sm"
              title="This tablet's branch"
            >
              📍 {deviceBranch ? deviceBranch.name : 'Not set'}
            </span>
          )}
          {/* Staff/admin controls (this is a logged-in staff tablet). */}
          {isAdmin && (
            <Link
              to="/admin"
              className="rounded-xl bg-white/5 px-3 py-2 text-sm font-medium text-brand-200 hover:bg-white/10 sm:px-4 sm:py-3 sm:text-base"
            >
              Admin
            </Link>
          )}
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-xl px-2 py-2 text-sm font-medium text-white/40 hover:text-white/70 sm:px-3 sm:py-3"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="min-h-0 flex-1 flex flex-col px-4 pb-10 sm:px-8">{children}</main>
    </div>
  )
}
