import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth/AuthProvider'

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
    (isActive ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-100')

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-800">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white p-4">
        <div className="mb-6 flex items-center gap-2 px-2">
          <span className="text-2xl">💅</span>
          <span className="font-bold">Galaxy Admin</span>
        </div>
        <nav className="space-y-1">
          <NavLink to="/admin/customers" className={linkClass}>
            Customers
          </NavLink>
          <NavLink to="/admin/loyalty" className={linkClass}>
            Loyalty settings
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
