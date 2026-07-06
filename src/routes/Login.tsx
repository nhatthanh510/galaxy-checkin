import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth/useAuth'

// Shared login (Supabase email/password). Everyone must sign in. After sign-in:
//   - admin -> /admin
//   - staff -> / (kiosk)
export function Login() {
  const { signIn, session, isAdmin, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Already signed in -> go to the right place for the role.
  if (!loading && session) {
    return <Navigate to={isAdmin ? '/admin' : '/'} replace />
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn(email, password)
      // The Navigate above takes over once auth state updates; nothing else to do.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0b12] px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg"
      >
        <div className="mb-4 flex justify-center">
          <img src="/logo.png" alt="Galaxy Nails" className="h-10 w-auto" />
        </div>
        <h1 className="text-center text-2xl font-bold text-slate-800">Sign in</h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          Staff and admins — sign in to continue
        </p>

        <label className="mt-6 block text-sm font-medium text-slate-600">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        />

        <label className="mt-4 block text-sm font-medium text-slate-600">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        />

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
