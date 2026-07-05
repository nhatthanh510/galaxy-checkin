import { useState } from 'react'
import {
  useServicesAdmin,
  useCreateService,
  useUpdateService,
  useDeleteService,
  type ServiceInput,
} from '../../lib/queries'
import type { Service } from '../../types'

type Mode = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; service: Service }

// Admin: CRUD over the service catalog. The kiosk shows only active services.
export function ServicesManage() {
  const { data: services, isLoading, error } = useServicesAdmin()
  const [mode, setMode] = useState<Mode>({ kind: 'list' })

  if (isLoading) return <p className="text-slate-500">Loading…</p>
  if (error) return <p className="text-red-600">{error.message}</p>

  if (mode.kind === 'create') {
    return <ServiceForm onDone={() => setMode({ kind: 'list' })} />
  }
  if (mode.kind === 'edit') {
    return <ServiceForm service={mode.service} onDone={() => setMode({ kind: 'list' })} />
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Services</h1>
          <p className="mt-1 text-sm text-slate-500">
            Only <span className="font-medium">active</span> services appear on the kiosk.
          </p>
        </div>
        <button
          onClick={() => setMode({ kind: 'create' })}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500"
        >
          New service
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Active</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(services ?? []).map((s) => (
              <ServiceRow key={s.id} service={s} onEdit={() => setMode({ kind: 'edit', service: s })} />
            ))}
            {services?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No services yet. Add one to show it on the kiosk.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ServiceRow({ service, onEdit }: { service: Service; onEdit: () => void }) {
  const del = useDeleteService()
  const onDelete = () => {
    if (window.confirm(`Delete "${service.name}"? This cannot be undone.`)) {
      del.mutate(service.id)
    }
  }
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3 font-medium text-slate-800">{service.name}</td>
      <td className="px-4 py-3 text-slate-600">{service.category}</td>
      <td className="px-4 py-3">
        <ActiveBadge active={service.active} />
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

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">active</span>
  ) : (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">inactive</span>
  )
}

function ServiceForm({ service, onDone }: { service?: Service; onDone: () => void }) {
  const create = useCreateService()
  const update = useUpdateService()
  const isEdit = Boolean(service)

  const [name, setName] = useState(service?.name ?? '')
  const [category, setCategory] = useState(service?.category ?? '')
  const [active, setActive] = useState(service?.active ?? true)

  const pending = create.isPending || update.isPending
  const err = create.error || update.error

  const onSubmit = async () => {
    const input: ServiceInput = { name: name.trim(), category: category.trim(), active }
    if (isEdit && service) {
      await update.mutateAsync({ id: service.id, ...input })
    } else {
      await create.mutateAsync(input)
    }
    onDone()
  }

  return (
    <div className="max-w-xl">
      <button onClick={onDone} className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to services
      </button>
      <h1 className="mt-2 text-2xl font-bold">{isEdit ? 'Edit service' : 'New service'}</h1>

      <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Regular Manicure"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Category</span>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Manicure Fastboy"
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
            disabled={pending || !name.trim() || !category.trim()}
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
