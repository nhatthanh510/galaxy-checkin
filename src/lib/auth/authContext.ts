import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type UserRole = 'staff' | 'admin'

// Auth context in its own (non-component) module so AuthProvider.tsx exports
// only a component — required for React Fast Refresh to work.
export interface AuthContextValue {
  session: Session | null
  role: UserRole | null // null until resolved / when not logged in
  isAdmin: boolean // convenience: role === 'admin'
  loading: boolean // true until the initial session + role check resolves
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
