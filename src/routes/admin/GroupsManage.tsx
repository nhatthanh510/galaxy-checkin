import { useState } from 'react'
import {
  useServiceGroups,
  useCreateServiceGroup,
  useUpdateServiceGroup,
  useDeleteServiceGroup,
  type ServiceGroupInput,
} from '../../lib/queries'
import type { ServiceGroup } from '../../types'
import { useConfirm } from '../../components/useConfirm'
import { TextInput } from '../../components/ui/TextInput'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'

type Mode = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; group: ServiceGroup }

// Admin: CRUD over service groups. Services are assigned to a group; the kiosk
// groups its service list by these.
export function GroupsManage() {
  const { data: groups, isLoading, error } = useServiceGroups(true)
  const [mode, setMode] = useState<Mode>({ kind: 'list' })

  if (isLoading) return <p className="text-slate-500">Loading…</p>
  if (error) return <p className="text-red-600">{error.message}</p>

  if (mode.kind === 'create') return <GroupForm onDone={() => setMode({ kind: 'list' })} />
  if (mode.kind === 'edit') {
    return <GroupForm group={mode.group} onDone={() => setMode({ kind: 'list' })} />
  }

  return (
    <div className="min-w-0 max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Service groups</h1>
          <p className="mt-1 text-sm text-slate-500">
            Services are organised into these groups on the kiosk.
          </p>
        </div>
        <Button onClick={() => setMode({ kind: 'create' })}>New group</Button>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Active</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(groups ?? []).map((g) => (
              <GroupRow key={g.id} group={g} onEdit={() => setMode({ kind: 'edit', group: g })} />
            ))}
            {groups?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                  No groups yet. Create one to organise services.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GroupRow({ group, onEdit }: { group: ServiceGroup; onEdit: () => void }) {
  const del = useDeleteServiceGroup()
  const { confirm, dialog } = useConfirm()
  const onDelete = async () => {
    if (
      await confirm({
        title: 'Delete group?',
        message: (
          <>
            Delete <span className="font-semibold text-slate-800">{group.name}</span>? Services in
            this group will become ungrouped.
          </>
        ),
        confirmLabel: 'Delete',
        danger: true,
      })
    ) {
      del.mutate(group.id)
    }
  }
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3 font-medium text-slate-800">{group.name}</td>
      <td className="px-4 py-3">
        {group.active ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">active</span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">inactive</span>
        )}
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

function GroupForm({ group, onDone }: { group?: ServiceGroup; onDone: () => void }) {
  const create = useCreateServiceGroup()
  const update = useUpdateServiceGroup()
  const isEdit = Boolean(group)
  const [name, setName] = useState(group?.name ?? '')
  const [active, setActive] = useState(group?.active ?? true)

  const pending = create.isPending || update.isPending
  const err = create.error || update.error

  const onSubmit = async () => {
    const input: ServiceGroupInput = { name: name.trim(), active }
    if (isEdit && group) await update.mutateAsync({ id: group.id, ...input })
    else await create.mutateAsync(input)
    onDone()
  }

  return (
    <div className="max-w-xl">
      <button onClick={onDone} className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to groups
      </button>
      <h1 className="mt-2 text-2xl font-bold">{isEdit ? 'Edit group' : 'New group'}</h1>

      <Card className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Name</span>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Manicure"
            className="mt-1"
          />
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
