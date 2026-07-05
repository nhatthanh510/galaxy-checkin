import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabase } from '../supabase'
import { AuthContext, type AuthContextValue } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  // Read the caller's own profile.is_admin. RLS lets a user read their own row.
  // Never throws — on any error (missing table, network) we treat as not-admin
  // so the guard resolves instead of hanging.
  const refreshIsAdmin = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setIsAdmin(false)
      return
    }
    try {
      const { data, error } = await getSupabase()
        .from('profile')
        .select('is_admin')
        .eq('id', uid)
        .maybeSingle()
      if (error) console.error('[AuthProvider] profile lookup error:', error.message)
      setIsAdmin(!error && Boolean(data?.is_admin))
    } catch (err) {
      console.error('[AuthProvider] profile lookup threw:', err)
      setIsAdmin(false)
    }
  }, [])

  useEffect(() => {
    const supabase = getSupabase()
    let active = true

    // Safety net: never let the guard hang on "Loading…" forever. If the initial
    // resolution hasn't finished within a few seconds (stalled network, etc.),
    // clear loading and proceed with whatever we have.
    const safety = setTimeout(() => {
      if (active) setLoading(false)
    }, 5000)

    // Resolve the INITIAL session + admin check exactly once. `finally`
    // guarantees loading clears even if the profile lookup errors.
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active) return
        setSession(data.session)
        await refreshIsAdmin(data.session?.user.id)
      })
      .catch((err) => console.error('[AuthProvider] getSession failed:', err))
      .finally(() => {
        if (active) {
          clearTimeout(safety)
          setLoading(false)
        }
      })

    // Keep session/isAdmin in sync on later auth changes (sign in/out, token
    // refresh). IMPORTANT: do NOT `await` a Supabase query directly inside this
    // callback — Supabase holds an internal lock while firing it, and an awaited
    // query here can deadlock (the "Loading… forever" on refresh). Defer the
    // profile lookup to a microtask so the callback returns and releases the lock.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!active) return
      setSession(s)
      void Promise.resolve().then(() => {
        if (active) void refreshIsAdmin(s?.user.id)
      })
    })

    return () => {
      active = false
      clearTimeout(safety)
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
