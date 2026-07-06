import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth/useAuth'

// Shared admin shell: light theme, sidebar nav, sign out. Renders child routes
// via <Outlet />.
export function AdminLayout() {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()

  const onSignOut = async () => {
    await signOut()
    navigate('/admin/login', { replace: true })
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    'block rounded-lg px-4 py-2.5 text-sm font-medium ' +
    (isActive ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100')

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-800">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white p-4">
        <div className="mb-6 flex flex-col gap-1 px-2">
          <img src="/logo.png" alt="Galaxy Nails" className="h-7 w-auto self-start" />
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Admin
          </span>
        </div>
        <nav className="space-y-1">
          <NavLink to="/admin/customers" className={linkClass}>
            Customers
          </NavLink>
          <NavLink to="/admin/services" className={linkClass}>
            Services
          </NavLink>
          <NavLink to="/admin/groups" className={linkClass}>
            Groups
          </NavLink>
          <NavLink to="/admin/staff" className={linkClass}>
            Preferred staff
          </NavLink>
          <NavLink to="/admin/loyalty" className={linkClass}>
            Loyalty settings
          </NavLink>
          <NavLink to="/admin/settings" className={linkClass}>
            Settings
          </NavLink>
        </nav>
        <div className="mt-auto border-t border-slate-200 pt-4">
          <p className="truncate px-2 text-xs text-slate-400">{session?.user.email}</p>
          <button
            onClick={onSignOut}
            className="mt-2 w-full rounded-lg px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
