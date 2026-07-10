import { useState } from 'react'
import {
  useServicesAdmin,
  useCreateService,
  useUpdateService,
  useDeleteService,
  useServiceGroups,
  type ServiceInput,
} from '../../lib/queries'
import type { Service } from '../../types'
import { Pagination } from '../../components/Pagination'
import { usePagination } from '../../components/usePagination'
import { useConfirm } from '../../components/useConfirm'
import { TextInput } from '../../components/ui/TextInput'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'

type Mode = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; service: Service }

// Admin: CRUD over the service catalog. The kiosk shows only active services.
export function ServicesManage() {
  const { data: services, isLoading, error } = useServicesAdmin()
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  // Paginate the list (called unconditionally to satisfy rules of hooks).
  const { page, pageCount, pageItems, setPage, canPrev, canNext, total } = usePagination(
    services ?? [],
    12,
  )

  if (isLoading) return <p className="text-slate-500">Loading…</p>
  if (error) return <p className="text-red-600">{error.message}</p>

  if (mode.kind === 'create') {
    return <ServiceForm onDone={() => setMode({ kind: 'list' })} />
  }
  if (mode.kind === 'edit') {
    return <ServiceForm service={mode.service} onDone={() => setMode({ kind: 'list' })} />
  }

  return (
    <div className="min-w-0 max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Services{total > 0 && ` (${total})`}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Only <span className="font-medium">active</span> services appear on the kiosk.
          </p>
        </div>
        <Button onClick={() => setMode({ kind: 'create' })}>New service</Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="max-h-[calc(100vh-16rem)] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-slate-500 shadow-sm">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Category</th>
                <th className="px-4 py-3 font-medium">Active</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
            {pageItems.map((s) => (
              <ServiceRow key={s.id} service={s} onEdit={() => setMode({ kind: 'edit', service: s })} />
            ))}
            {total === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No services yet. Add one to show it on the kiosk.
                </td>
              </tr>
            )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pageCount={pageCount}
          canPrev={canPrev}
          canNext={canNext}
          onPage={setPage}
        />
      </div>
    </div>
  )
}

function ServiceRow({ service, onEdit }: { service: Service; onEdit: () => void }) {
  const del = useDeleteService()
  const { confirm, dialog } = useConfirm()
  const onDelete = async () => {
    if (
      await confirm({
        title: 'Delete service?',
        message: (
          <>
            Delete <span className="font-semibold text-slate-800">{service.name}</span>? This
            cannot be undone.
          </>
        ),
        confirmLabel: 'Delete',
        danger: true,
      })
    ) {
      del.mutate(service.id)
    }
  }
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3 align-top font-medium text-slate-800">
        {service.name}
        {/* Mobile: category under the name (own column hidden). */}
        <div className="text-xs font-normal text-slate-400 sm:hidden">{service.category}</div>
      </td>
      <td className="hidden px-4 py-3 align-top text-slate-600 sm:table-cell">{service.category}</td>
      <td className="px-4 py-3 align-top">
        <ActiveBadge active={service.active} />
      </td>
      <td className="px-4 py-3 text-right">
        <button onClick={onEdit} className="text-sm text-brand-600 hover:text-brand-800">
          Edit
        </button>
        <button
          onClick={onDelete}
          disabled={del.isPending}
          className="ml-3 text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
        >
          Delete
        </button>
        {dialog}
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
  const { data: groups } = useServiceGroups(true)
  const isEdit = Boolean(service)

  const [name, setName] = useState(service?.name ?? '')
  const [groupId, setGroupId] = useState(service?.groupId ?? '')
  const [active, setActive] = useState(service?.active ?? true)

  const pending = create.isPending || update.isPending
  const err = create.error || update.error

  const onSubmit = async () => {
    // Keep the denormalized `category` in sync with the chosen group's name so
    // the kiosk fallback and existing displays still work.
    const group = (groups ?? []).find((g) => g.id === groupId)
    const input: ServiceInput = {
      name: name.trim(),
      groupId: groupId || null,
      category: group?.name ?? service?.category ?? '',
      active,
    }
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

      <Card className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Name</span>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Regular Manicure"
            className="mt-1"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Group</span>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          >
            <option value="">— No group —</option>
            {(groups ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
                {g.active ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 accent-brand-600"
          />
          <span className="text-sm text-slate-600">Active (shown on the kiosk)</span>
        </label>

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
