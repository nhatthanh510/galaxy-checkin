// A simple centered loading spinner for full-screen auth/route-guard waits,
// where the incoming screen's shape isn't known yet (so a skeleton would be
// wrong). `tone` matches the surface: 'light' for the admin, 'dark' for kiosk.
export function FullScreenSpinner({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const dark = tone === 'dark'
  return (
    <div
      className={
        'flex min-h-screen flex-col items-center justify-center gap-4 ' +
        (dark ? 'bg-[#0b0b12] text-white/60' : 'bg-slate-100 text-slate-500')
      }
      role="status"
      aria-live="polite"
    >
      <div
        className={
          'h-10 w-10 animate-spin rounded-full border-4 ' +
          (dark ? 'border-white/15 border-t-white/70' : 'border-slate-300 border-t-brand-600')
        }
      />
      <span className="text-sm">Loading…</span>
    </div>
  )
}
