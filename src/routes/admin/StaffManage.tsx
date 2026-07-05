import { useState } from 'react'
import {
  useTechniciansAdmin,
  useCreateTechnician,
  useUpdateTechnician,
  useDeleteTechnician,
  type TechnicianInput,
} from '../../lib/queries'
import type { Technician } from '../../types'

type Mode = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; tech: Technician }

// Admin: CRUD over technicians (preferred staff). The kiosk shows only active
// technicians in the "choose your staff" grid.
export function StaffManage() {
  const { data: techs, isLoading, error } = useTechniciansAdmin()
  const [mode, setMode] = useState<Mode>({ kind: 'list' })

  if (isLoading) return <p className="text-slate-500">Loading…</p>
  if (error) return <p className="text-red-600">{error.message}</p>

  if (mode.kind === 'create') {
    return <StaffForm onDone={() => setMode({ kind: 'list' })} />
  }
  if (mode.kind === 'edit') {
    return <StaffForm tech={mode.tech} onDone={() => setMode({ kind: 'list' })} />
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Preferred staff</h1>
          <p className="mt-1 text-sm text-slate-500">
            Only <span className="font-medium">active</span> staff appear on the kiosk.
          </p>
        </div>
        <button
          onClick={() => setMode({ kind: 'create' })}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500"
        >
          New staff
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Active</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(techs ?? []).map((t) => (
              <StaffRow key={t.id} tech={t} onEdit={() => setMode({ kind: 'edit', tech: t })} />
            ))}
            {techs?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                  No staff yet. Add one to show it on the kiosk.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StaffRow({ tech, onEdit }: { tech: Technician; onEdit: () => void }) {
  const del = useDeleteTechnician()
  const onDelete = () => {
    if (window.confirm(`Delete "${tech.name}"? This cannot be undone.`)) {
      del.mutate(tech.id)
    }
  }
  const initial = tech.name.charAt(0).toUpperCase()
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-sm font-bold text-white">
            {initial}
          </span>
          <span className="font-medium text-slate-800">{tech.name}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        {tech.active ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">active</span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">inactive</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <button onClick={onEdit} className="text-sm text-purple-600 hover:text-purple-800">
          Edit
        </button>
        <button
          onClick={onDelete}
          disabled={del.isPending}
          className="ml-3 text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
        >
          Delete
        </button>
      </td>
    </tr>
  )
}

function StaffForm({ tech, onDone }: { tech?: Technician; onDone: () => void }) {
  const create = useCreateTechnician()
  const update = useUpdateTechnician()
  const isEdit = Boolean(tech)

  const [name, setName] = useState(tech?.name ?? '')
  const [active, setActive] = useState(tech?.active ?? true)

  const pending = create.isPending || update.isPending
  const err = create.error || update.error

  const onSubmit = async () => {
    const input: TechnicianInput = { name: name.trim(), active }
    if (isEdit && tech) {
      await update.mutateAsync({ id: tech.id, ...input })
    } else {
      await create.mutateAsync(input)
    }
    onDone()
  }

  return (
    <div className="max-w-xl">
      <button onClick={onDone} className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to staff
      </button>
      <h1 className="mt-2 text-2xl font-bold">{isEdit ? 'Edit staff' : 'New staff'}</h1>

      <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Anna"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 accent-purple-600"
          />
          <span className="text-sm text-slate-600">Active (shown on the kiosk)</span>
        </label>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onSubmit}
            disabled={pending || !name.trim()}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
          >
            {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
          </button>
          <button onClick={onDone} className="text-sm text-slate-500 hover:text-slate-700">
            Cancel
          </button>
          {err && <span className="text-sm text-red-600">{err.message}</span>}
        </div>
      </div>
    </div>
  )
}
