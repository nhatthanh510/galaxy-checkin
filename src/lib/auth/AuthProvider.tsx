import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabase } from '../supabase'

interface AuthContextValue {
  session: Session | null
  isAdmin: boolean
  loading: boolean // true until the initial session + admin check resolves
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  // Read the caller's own profile.is_admin. RLS lets a user read their own row.
  const refreshIsAdmin = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setIsAdmin(false)
      return
    }
    const { data, error } = await getSupabase()
      .from('profile')
      .select('is_admin')
      .eq('id', uid)
      .maybeSingle()
    setIsAdmin(!error && Boolean(data?.is_admin))
  }, [])

  useEffect(() => {
    const supabase = getSupabase()
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await refreshIsAdmin(data.session?.user.id)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!active) return
      setSession(s)
      await refreshIsAdmin(s?.user.id)
      setLoading(false)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [refreshIsAdmin])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ session, isAdmin, loading, signIn, signOut }),
    [session, isAdmin, loading, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
