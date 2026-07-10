import { useState } from 'react'
import {
  useLoyaltyPrograms,
  useCreateLoyaltyProgram,
  useUpdateLoyaltyProgramCrud,
  useDeleteLoyaltyProgram,
  useSettings,
  type LoyaltyProgramInput,
} from '../../lib/queries'
import type { LoyaltyProgram, PromotionTrigger, RewardType } from '../../types'
import { formatReward } from '../../lib/reward'
import { birthdayTierSummary } from '../../lib/tier'

// Human labels for each trigger, used in the list, view, and form.
const TRIGGER_LABELS: Record<PromotionTrigger, string> = {
  points: 'Points reward',
  date_window: '🎂 Birthday reward',
  always: 'Standing promo',
}

// Short "how it's earned → reward" summary for the list row.
function earnSummary(p: LoyaltyProgram): string {
  const reward = formatReward(p.rewardType, p.rewardValue)
  switch (p.triggerType) {
    case 'date_window':
      return '🎂 Birthday → % off by tier'
    case 'always':
      return `Any visit → ${reward}`
    default:
      return `${p.pointsPerReward} pts → ${reward}`
  }
}

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

  if (isLoading) return <p className="text-slate-500">Loading…</p>
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
        <button
          onClick={() => setMode({ kind: 'create' })}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500"
        >
          New program
        </button>
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

  const onDelete = () => {
    if (window.confirm(`Delete "${program.name}"? This cannot be undone.`)) {
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
      </td>
    </tr>
  )
}

function ProgramView({ program, onBack }: { program: LoyaltyProgram; onBack: () => void }) {
  return (
    <div className="max-w-xl">
      <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to programs
      </button>
      <h1 className="mt-2 text-2xl font-bold">{program.name}</h1>
      <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-6 text-sm">
        <Field label="Description" value={program.description} />
        <Field label="Trigger" value={TRIGGER_LABELS[program.triggerType]} />
        {program.triggerType === 'points' && (
          <Field label="Points per reward" value={String(program.pointsPerReward)} />
        )}
        {program.triggerType === 'date_window' && (
          <Field
            label="Claim window"
            value={`${program.windowBeforeDays} days before → ${program.windowAfterDays} days after birthday`}
          />
        )}
        {program.triggerType === 'date_window' ? (
          <Field
            label="Reward"
            value="Percent off by customer tier — set on the Settings page"
          />
        ) : (
          <Field
            label="Reward"
            value={formatReward(program.rewardType, program.rewardValue)}
          />
        )}
        <Field label="Status" value={program.active ? 'Active' : 'Inactive'} />
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 pb-2 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  )
}

// Create/edit form. Seeded from `program` on edit (via key remount in the list).
function ProgramForm({
  program,
  onDone,
}: {
  program?: LoyaltyProgram
  onDone: () => void
}) {
  const create = useCreateLoyaltyProgram()
  const update = useUpdateLoyaltyProgramCrud()
  const { data: settings } = useSettings()
  const isEdit = Boolean(program)

  // For birthday programs the description is auto-generated from the tier
  // percents (Settings page), so it can never go stale.
  const tierPercents = {
    new: settings?.birthdayPercentNew ?? 10,
    regular: settings?.birthdayPercentRegular ?? 15,
    vip: settings?.birthdayPercentVip ?? 20,
  }

  const [name, setName] = useState(program?.name ?? '')
  const [description, setDescription] = useState(program?.description ?? '')
  const [triggerType, setTriggerType] = useState<PromotionTrigger>(
    program?.triggerType ?? 'points',
  )
  const [pointsPerReward, setPointsPerReward] = useState(String(program?.pointsPerReward ?? 10))
  const [windowBefore, setWindowBefore] = useState(String(program?.windowBeforeDays ?? 7))
  const [windowAfter, setWindowAfter] = useState(String(program?.windowAfterDays ?? 7))
  const [rewardType, setRewardType] = useState<RewardType>(program?.rewardType ?? 'fixed')
  const [rewardValue, setRewardValue] = useState(String(program?.rewardValue ?? 10))
  const [active, setActive] = useState(program?.active ?? true)

  const pending = create.isPending || update.isPending
  const err = create.error || update.error

  const onSubmit = async () => {
    const input: LoyaltyProgramInput = {
      name: name.trim(),
      // Birthday: store the tier-percent summary; other triggers: the typed text.
      description:
        triggerType === 'date_window' ? birthdayTierSummary(tierPercents) : description.trim(),
      triggerType,
      // Only date-window triggers anchor on a customer date (birthday for now).
      dateAnchor: triggerType === 'date_window' ? 'birthday' : null,
      windowBeforeDays: Math.max(0, Number(windowBefore) || 0),
      windowAfterDays: Math.max(0, Number(windowAfter) || 0),
      pointsPerReward: triggerType === 'points' ? Number(pointsPerReward) || 0 : 0,
      rewardType,
      rewardValue: Number(rewardValue) || 0,
      active,
    }
    if (isEdit && program) {
      await update.mutateAsync({ id: program.id, ...input })
    } else {
      await create.mutateAsync(input)
    }
    onDone()
  }

  return (
    <div className="max-w-xl">
      <button onClick={onDone} className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to programs
      </button>
      <h1 className="mt-2 text-2xl font-bold">{isEdit ? 'Edit program' : 'New program'}</h1>

      <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Program name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="10 Point"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
        </label>
        {/* Birthday programs auto-generate their description from the tier
            percents, so the free-text field is hidden for them. */}
        {triggerType === 'date_window' ? (
          <div className="block">
            <span className="text-sm font-medium text-slate-600">Description</span>
            <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {birthdayTierSummary(tierPercents)}
              <span className="mt-1 block text-xs text-slate-400">
                Auto-generated from the tier percents on the Settings page.
              </span>
            </p>
          </div>
        ) : (
          <label className="block">
            <span className="text-sm font-medium text-slate-600">Description</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="10 points get $10 off"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </label>
        )}
        {/* Trigger: how the reward becomes claimable. */}
        <label className="block">
          <span className="text-sm font-medium text-slate-600">How is it earned?</span>
          <select
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value as PromotionTrigger)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          >
            <option value="points">Points — redeem when the customer has enough points</option>
            <option value="date_window">🎂 Birthday — claimed around the customer's birthday</option>
            <option value="always">Standing promo — claimable on any visit</option>
          </select>
          <span className="mt-1 block text-xs text-slate-400">
            {triggerType === 'points' && 'The customer spends points to redeem this reward.'}
            {triggerType === 'date_window' &&
              'No points needed — claimable once per year inside the birthday window below.'}
            {triggerType === 'always' && 'No points needed — claimable once per year on any visit.'}
          </span>
        </label>

        {/* Points threshold — only for the points trigger. */}
        {triggerType === 'points' && (
          <label className="block">
            <span className="text-sm font-medium text-slate-600">Points per reward</span>
            <input
              type="number"
              value={pointsPerReward}
              onChange={(e) => setPointsPerReward(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </label>
        )}

        {/* Claim window — only for date-window (birthday) triggers. */}
        {triggerType === 'date_window' && (
          <div className="grid grid-cols-2 gap-4 rounded-lg bg-pink-50 p-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Days before birthday</span>
              <input
                type="number"
                min={0}
                value={windowBefore}
                onChange={(e) => setWindowBefore(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Days after birthday</span>
              <input
                type="number"
                min={0}
                value={windowAfter}
                onChange={(e) => setWindowAfter(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200"
              />
            </label>
          </div>
        )}

        {/* Birthday rewards derive their percent from the customer's tier — the
            reward type/amount inputs don't apply, so hide them and explain. */}
        {triggerType === 'date_window' ? (
          <div className="rounded-lg bg-pink-50 px-4 py-3 text-sm text-pink-700">
            <span className="font-medium">Reward: percent off by customer tier.</span> Birthday
            discounts use the New / Regular / VIP percentages configured on the{' '}
            <span className="font-medium">Settings</span> page, so there's nothing to set here.
          </div>
        ) : (
          <>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Reward type</span>
              <select
                value={rewardType}
                onChange={(e) => setRewardType(e.target.value as RewardType)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              >
                <option value="fixed">Fixed amount ($)</option>
                <option value="percent">Percentage (%)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">
                {rewardType === 'percent' ? 'Reward percentage (%)' : 'Reward amount ($)'}
              </span>
              <input
                type="number"
                value={rewardValue}
                onChange={(e) => setRewardValue(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              />
            </label>
          </>
        )}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 accent-brand-600"
          />
          <span className="text-sm text-slate-600">
            Active (shown on the kiosk — only one should be active)
          </span>
        </label>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onSubmit}
            disabled={pending || !name.trim()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
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
