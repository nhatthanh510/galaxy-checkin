import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth/useAuth'

// Nav items with an icon (used in the collapsed desktop rail) + label.
const NAV_ITEMS = [
  { to: '/admin/customers', label: 'Customers', icon: '👥' },
  { to: '/admin/checkins', label: 'Check-ins', icon: '📋' },
  { to: '/admin/services', label: 'Services', icon: '💅' },
  { to: '/admin/groups', label: 'Groups', icon: '🗂️' },
  { to: '/admin/branches', label: 'Branches', icon: '📍' },
  { to: '/admin/loyalty', label: 'Loyalty settings', icon: '🎁' },
  { to: '/admin/marketing', label: 'Marketing SMS', icon: '📣' },
  { to: '/admin/sms-templates', label: 'SMS templates', icon: '✉️' },
  { to: '/admin/settings', label: 'Settings', icon: '⚙️' },
] as const

const COLLAPSE_KEY = 'admin.sidebarCollapsed'

// "Panel-left" toggle icon (the modern sidebar-collapse standard). Same icon for
// both states; the tooltip conveys the action.
// "Panel-left" sidebar toggle icon (VS Code / Vercel standard). Same icon for
// collapse and expand; the tooltip conveys the action.
function PanelLeftIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
    </svg>
  )
}

// Shared admin shell. The sidebar is:
//   - a slide-in drawer + hamburger on mobile/tablet (below md), and
//   - a static sidebar on desktop (md+) that toggles between full and an
//     icon-only rail (persisted to localStorage).
export function AdminLayout() {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === '1',
  )

  const onSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      return next
    })
  }

  const closeDrawer = () => setDrawerOpen(false)

  // `rail` = show icon-only layout. In the mobile drawer we always show labels.
  const linkClass = (rail: boolean) => ({ isActive }: { isActive: boolean }) =>
    'flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium ' +
    (rail ? 'justify-center px-2' : 'px-4') +
    ' ' +
    (isActive ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100')

  const navList = (rail: boolean) => (
    <nav className="space-y-1" onClick={closeDrawer}>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={linkClass(rail)}
          title={rail ? item.label : undefined}
        >
          <span className="text-base leading-none">{item.icon}</span>
          {!rail && <span>{item.label}</span>}
        </NavLink>
      ))}
    </nav>
  )

  // `desktop` marks the static desktop sidebar (which shows the collapse toggle);
  // the mobile drawer passes false and never shows it.
  const sidebarInner = (rail: boolean) => (
    <>
      {rail ? (
        // Collapsed rail: just the logo, centered (Linear/Notion style). The
        // expand toggle lives in the main content's top bar.
        <div className="mb-6 flex justify-center">
          <img src="/favicon.ico" alt="Galaxy Nails" className="h-8 w-8 object-contain" />
        </div>
      ) : (
        <div className="mb-6 flex flex-col gap-1 px-2">
          <img src="/logo.png" alt="Galaxy Nails" className="h-7 w-auto self-start" />
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Admin
          </span>
        </div>
      )}
      {navList(rail)}
      <div className="mt-auto border-t border-slate-200 pt-4">
        {rail ? (
          <>
            <Link
              to="/"
              title="Go to kiosk"
              className="mb-1 flex justify-center rounded-lg py-2 text-lg text-brand-700 hover:bg-slate-100"
            >
              🖥️
            </Link>
            <button
              onClick={onSignOut}
              title="Sign out"
              className="flex w-full justify-center rounded-lg py-2 text-lg text-slate-600 hover:bg-slate-100"
            >
              ⎋
            </button>
          </>
        ) : (
          <>
            <Link
              to="/"
              className="mb-2 block rounded-lg px-4 py-2 text-sm font-medium text-brand-700 hover:bg-slate-100"
            >
              ← Go to kiosk
            </Link>
            <p className="truncate px-2 text-xs text-slate-400">{session?.user.email}</p>
            <button
              onClick={onSignOut}
              className="mt-2 w-full rounded-lg px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-100"
            >
              Sign out
            </button>
          </>
        )}
      </div>
    </>
  )

  return (
    <div className="flex h-screen bg-slate-100 text-slate-800">
      {/* Backdrop (mobile drawer only). */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={closeDrawer}
          aria-hidden
        />
      )}

      {/* Mobile drawer (below md): always full labels. */}
      <aside
        className={
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-slate-200 bg-white p-4 transition-transform md:hidden ' +
          (drawerOpen ? 'translate-x-0' : '-translate-x-full')
        }
      >
        {sidebarInner(false)}
      </aside>

      {/* Desktop sidebar (md+): static, full or icon-rail. */}
      <aside
        className={
          'hidden shrink-0 flex-col border-r border-slate-200 bg-white p-4 transition-all md:flex ' +
          (collapsed ? 'w-20' : 'w-60')
        }
      >
        {sidebarInner(collapsed)}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Mobile top bar with hamburger (hidden on md+). */}
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <img src="/logo.png" alt="Galaxy Nails" className="h-6 w-auto" />
        </header>

        {/* Desktop top bar: holds the sidebar collapse/expand toggle (Linear/
            Notion style — the control lives in the content header, not the rail). */}
        <header className="hidden items-center border-b border-slate-200 bg-white px-3 py-2 md:flex">
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <PanelLeftIcon />
          </button>
        </header>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
