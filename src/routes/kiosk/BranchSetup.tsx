import { useNavigate } from 'react-router-dom'
import { KioskLayout } from '../../components/KioskLayout'
import { BackButton } from '../../components/BackButton'
import { useBranches } from '../../lib/queries'
import { getDeviceBranchSlug, setDeviceBranchSlug } from '../../lib/branch'

// Kiosk device setup: assign THIS tablet to a branch (stored in localStorage).
// ADMIN-ONLY (route-gated by RequireAdmin) — regular staff only view the branch
// read-only in the kiosk header; they can't reach or change it here. Optional —
// a tablet with no branch still checks customers in, recording a branchless
// (null) visit. Reached from the admin's "📍 … · change" header link.
export function BranchSetup() {
  const navigate = useNavigate()
  const { data: branches, isLoading } = useBranches(false)
  const currentSlug = getDeviceBranchSlug()

  const pick = (slug: string | null) => {
    setDeviceBranchSlug(slug)
    navigate('/', { replace: true })
  }

  return (
    <KioskLayout showStartOver={false}>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center">
        <div className="flex items-center gap-4">
          <BackButton />
          <h1 className="flex-1 text-center text-4xl font-black tracking-wide text-white">
            THIS TABLET
          </h1>
          <div className="h-12 w-12 shrink-0" aria-hidden />
        </div>
        <p className="mt-3 text-center text-xl text-white/60">
          Which branch is this tablet at? Check-ins from this tablet are recorded here.
        </p>

        <div className="mt-10 space-y-3">
          {isLoading && <p className="text-center text-white/50">Loading branches…</p>}

          {!isLoading &&
            (branches ?? []).map((b) => {
              const active = b.slug === currentSlug
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => pick(b.slug)}
                  className={
                    'flex w-full items-center justify-between rounded-2xl border px-8 py-6 text-left text-2xl font-bold transition-colors ' +
                    (active
                      ? 'border-brand-400 bg-brand-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-white/90 hover:bg-white/10')
                  }
                >
                  <span>📍 {b.name}</span>
                  {active && <span className="text-brand-300">✓ Current</span>}
                </button>
              )
            })}

          {/* No branch / clear — an explicit, first-class choice. */}
          <button
            type="button"
            onClick={() => pick(null)}
            className={
              'flex w-full items-center justify-between rounded-2xl border px-8 py-6 text-left text-2xl font-bold transition-colors ' +
              (currentSlug == null
                ? 'border-brand-400 bg-brand-500/20 text-white'
                : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10')
            }
          >
            <span>No branch</span>
            {currentSlug == null && <span className="text-brand-300">✓ Current</span>}
          </button>
        </div>

        {!isLoading && (branches ?? []).length === 0 && (
          <p className="mt-8 text-center text-base text-white/50">
            No branches have been set up yet. An admin can add them under
            Admin → Branches. Until then, check-ins are recorded without a branch.
          </p>
        )}
      </div>
    </KioskLayout>
  )
}
