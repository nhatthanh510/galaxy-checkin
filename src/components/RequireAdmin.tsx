import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth/useAuth'
import { FullScreenSpinner } from './ui/Spinner'

// Route guard for the admin area:
//   - still loading      -> spinner
//   - no session         -> redirect to /login
//   - logged in, staff   -> "not authorized" (staff can't open admin)
//   - admin              -> render children
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, isAdmin, loading } = useAuth()

  if (loading) {
    return <FullScreenSpinner tone="light" />
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-100 text-slate-700">
        <h1 className="text-2xl font-bold">Not authorized</h1>
        <p className="text-slate-500">Your account doesn't have admin access.</p>
        <a href="/" className="text-brand-600 underline">
          Go to the kiosk
        </a>
      </div>
    )
  }

  return <>{children}</>
}
