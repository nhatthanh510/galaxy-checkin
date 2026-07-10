import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth/useAuth'
import { FullScreenSpinner } from './ui/Spinner'

// Route guard for the kiosk: any logged-in user (staff or admin) may use it.
//   - still loading -> spinner
//   - no session    -> redirect to /login
//   - logged in     -> render children
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return <FullScreenSpinner tone="dark" />
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
