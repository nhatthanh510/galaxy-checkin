import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth/useAuth'

// Admin login (Supabase email/password). Admin access additionally requires
// profile.is_admin — enforced by RequireAdmin after sign-in.
export function Login() {
  const { signIn, session, isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Already signed in as an admin -> go to the dashboard.
  if (!loading && session && isAdmin) {
    return <Navigate to="/admin/customers" replace />
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn(email, password)
      navigate('/admin/customers', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg"
      >
        <h1 className="text-2xl font-bold text-slate-800">Admin sign in</h1>
        <p className="mt-1 text-sm text-slate-500">Galaxy Check-In administration</p>

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
        {session && !isAdmin && (
          <p className="mt-4 text-sm text-amber-600">
            Signed in, but this account is not an admin.
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        <a href="/" className="mt-4 block text-center text-sm text-slate-400 hover:text-slate-600">
          ← Back to kiosk
        </a>
      </form>
    </div>
  )
}
