import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth/useAuth'

// Route guard for the admin area:
//   - still loading      -> spinner
//   - no session         -> redirect to login
//   - session, not admin -> "not authorized"
//   - admin              -> render children
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, isAdmin, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-500">
        Loading…
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/admin/login" replace />
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-100 text-slate-700">
        <h1 className="text-2xl font-bold">Not authorized</h1>
        <p className="text-slate-500">This account does not have admin access.</p>
        <a href="/admin/login" className="text-brand-600 underline">
          Sign in with a different account
        </a>
      </div>
    )
  }

  return <>{children}</>
}
