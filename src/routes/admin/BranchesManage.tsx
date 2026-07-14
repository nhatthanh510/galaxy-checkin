import { useState } from 'react'
import { useBranches, useCreateBranch, useUpdateBranch } from '../../lib/queries'
import type { Branch } from '../../types'
import {
  slugifyBranchName,
  getDeviceBranchSlug,
  setDeviceBranchSlug,
} from '../../lib/branch'
import { TextInput } from '../../components/ui/TextInput'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { TableSkeleton } from '../../components/ui/Skeleton'

type Mode = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; branch: Branch }

// Admin: manage physical branches (e.g. Kings Meadows, Brisbane). Each kiosk
// tablet is assigned to one of these; every check-in stamps its branch. Branches
// are deactivated rather than deleted so check-in history stays intact.
export function BranchesManage() {
  const { data: branches, isLoading, error } = useBranches(true)
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  // Which branch is THIS device assigned to (localStorage slug). Held in state so
  // ticking a row updates the radios immediately without a reload. Single-select:
  // a device is at one branch, so setting one clears the rest; tick the current
  // one again to clear (No branch → branchless check-ins from this device).
  const [deviceSlug, setDeviceSlug] = useState<string | null>(() => getDeviceBranchSlug())
  const setDevice = (slug: string | null) => {
    setDeviceBranchSlug(slug)
    setDeviceSlug(slug)
  }

  if (isLoading) return <TableSkeleton cols={4} className="min-w-0 max-w-3xl" />
  if (error) return <p className="text-red-600">{error.message}</p>

  if (mode.kind === 'create') return <BranchForm onDone={() => setMode({ kind: 'list' })} />
  if (mode.kind === 'edit') {
    return <BranchForm branch={mode.branch} onDone={() => setMode({ kind: 'list' })} />
  }

  return (
    <div className="min-w-0 max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Branches</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your physical locations. Each kiosk tablet is assigned a branch, and every
            check-in records where it happened.
          </p>
        </div>
        <Button onClick={() => setMode({ kind: 'create' })}>New branch</Button>
      </div>

      {/* "This device" ticks which branch THIS tablet checks customers in at —
          saved to this device's localStorage, so set it from the tablet itself. */}
      <p className="mb-2 text-sm text-slate-500">
        Tick <span className="font-medium text-slate-700">This device</span> for the branch this
        tablet is at. It's saved on this device only, and kiosk check-ins from here stamp that branch.
      </p>

      <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Active</th>
              <th className="px-4 py-3 font-medium text-center">This device</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(branches ?? []).map((b) => {
              const isThisDevice = b.slug === deviceSlug
              return (
                <tr key={b.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-800">{b.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{b.slug}</td>
                  <td className="px-4 py-3">
                    {b.active ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                        active
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {/* Radio-style: click sets this branch; clicking the active
                        one again clears it (back to No branch). */}
                    <input
                      type="checkbox"
                      checked={isThisDevice}
                      onChange={() => setDevice(isThisDevice ? null : b.slug)}
                      aria-label={`Set this device to ${b.name}`}
                      className="h-4 w-4 accent-brand-600"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setMode({ kind: 'edit', branch: b })}
                      className="text-sm text-brand-600 hover:text-brand-800"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              )
            })}
            {branches?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No branches yet. Create one so kiosks can record where customers check in.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {deviceSlug == null && (branches ?? []).length > 0 && (
        <p className="mt-3 text-sm text-slate-400">
          This device isn't assigned to a branch — its check-ins are recorded without one.
        </p>
      )}
    </div>
  )
}

function BranchForm({ branch, onDone }: { branch?: Branch; onDone: () => void }) {
  const create = useCreateBranch()
  const update = useUpdateBranch()
  const isEdit = Boolean(branch)
  const [name, setName] = useState(branch?.name ?? '')
  const [active, setActive] = useState(branch?.active ?? true)

  const pending = create.isPending || update.isPending
  const err = create.error || update.error
  // Preview the slug for a new branch (stable, not re-derived on rename in edit).
  const previewSlug = branch?.slug ?? slugifyBranchName(name)

  const onSubmit = async () => {
    if (isEdit && branch) {
      await update.mutateAsync({ id: branch.id, name: name.trim(), active })
    } else {
      await create.mutateAsync({ name: name.trim() })
    }
    onDone()
  }

  return (
    <div className="max-w-xl">
      <button onClick={onDone} className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to branches
      </button>
      <h1 className="mt-2 text-2xl font-bold">{isEdit ? 'Edit branch' : 'New branch'}</h1>

      <Card className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Name</span>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Kings Meadows"
            className="mt-1"
          />
          {name.trim() && (
            <span className="mt-1 block text-xs text-slate-400">
              Slug: <span className="font-mono">{previewSlug || '—'}</span>
              {isEdit && ' (fixed — tablets stay assigned to it)'}
            </span>
          )}
        </label>

        {isEdit && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 accent-brand-600"
            />
            <span className="text-sm text-slate-600">
              Active (selectable on the kiosk). Deactivating keeps its check-in history.
            </span>
          </label>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={onSubmit} disabled={pending || !name.trim()}>
            {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
          </Button>
          <button onClick={onDone} className="text-sm text-slate-500 hover:text-slate-700">
            Cancel
          </button>
          {err && <span className="text-sm text-red-600">{err.message}</span>}
        </div>
      </Card>
    </div>
  )
}
