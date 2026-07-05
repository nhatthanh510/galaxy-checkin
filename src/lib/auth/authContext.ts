import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'

// Auth context in its own (non-component) module so AuthProvider.tsx exports
// only a component — required for React Fast Refresh to work.
export interface AuthContextValue {
  session: Session | null
  isAdmin: boolean
  loading: boolean // true until the initial session + admin check resolves
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
