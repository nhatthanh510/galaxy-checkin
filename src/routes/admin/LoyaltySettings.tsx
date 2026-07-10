import { useState } from 'react'
import { useLoyaltyPrograms, useDeleteLoyaltyProgram } from '../../lib/queries'
import type { LoyaltyProgram } from '../../types'
import { useConfirm } from '../../components/useConfirm'
import { Button } from '../../components/ui/Button'
import { TableSkeleton } from '../../components/ui/Skeleton'
import { ProgramForm } from './LoyaltyProgramForm'
import { ProgramView } from './LoyaltyProgramView'
import { earnSummary } from './loyaltyLabels'

type Mode =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'edit'; program: LoyaltyProgram }
  | { kind: 'view'; program: LoyaltyProgram }

// Admin: full CRUD over loyalty programs. The kiosk shows the single *active*
// program (see useLoyaltyProgram); manage all of them here.
export function LoyaltySettings() {
  const { data: programs, isLoading, error } = useLoyaltyPrograms()
  const [mode, setMode] = useState<Mode>({ kind: 'list' })

  if (isLoading) return <TableSkeleton cols={4} className="max-w-3xl" />
  if (error) return <p className="text-red-600">{error.message}</p>

  if (mode.kind === 'create') {
    return <ProgramForm onDone={() => setMode({ kind: 'list' })} />
  }
  if (mode.kind === 'edit') {
    return <ProgramForm program={mode.program} onDone={() => setMode({ kind: 'list' })} />
  }
  if (mode.kind === 'view') {
    return <ProgramView program={mode.program} onBack={() => setMode({ kind: 'list' })} />
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Loyalty programs</h1>
          <p className="mt-1 text-sm text-slate-500">
            The kiosk shows the single <span className="font-medium">active</span> program.
          </p>
        </div>
        <Button onClick={() => setMode({ kind: 'create' })}>New program</Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Reward</th>
              <th className="px-4 py-3 font-medium">Active</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(programs ?? []).map((p) => (
              <ProgramRow
                key={p.id}
                program={p}
                onView={() => setMode({ kind: 'view', program: p })}
                onEdit={() => setMode({ kind: 'edit', program: p })}
              />
            ))}
            {programs?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No programs yet. Create one to show it on the kiosk.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ProgramRow({
  program,
  onView,
  onEdit,
}: {
  program: LoyaltyProgram
  onView: () => void
  onEdit: () => void
}) {
  const del = useDeleteLoyaltyProgram()
  const { confirm, dialog } = useConfirm()

  const onDelete = async () => {
    if (
      await confirm({
        title: 'Delete program?',
        message: (
          <>
            Delete <span className="font-semibold text-slate-800">{program.name}</span>? This
            cannot be undone.
          </>
        ),
        confirmLabel: 'Delete',
        danger: true,
      })
    ) {
      del.mutate(program.id)
    }
  }

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3">
        <button onClick={onView} className="font-medium text-brand-700 hover:underline">
          {program.name}
        </button>
        <div className="text-xs text-slate-400">{program.description}</div>
      </td>
      <td className="px-4 py-3 text-slate-600">{earnSummary(program)}</td>
      <td className="px-4 py-3">
        {program.active ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
            active
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            inactive
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <button onClick={onView} className="text-sm text-slate-500 hover:text-slate-700">
          View
        </button>
        <button onClick={onEdit} className="ml-3 text-sm text-brand-600 hover:text-brand-800">
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
