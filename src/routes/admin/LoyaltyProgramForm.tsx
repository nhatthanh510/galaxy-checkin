import { useState } from 'react'
import {
  useCreateLoyaltyProgram,
  useUpdateLoyaltyProgramCrud,
  useSettings,
  type LoyaltyProgramInput,
} from '../../lib/queries'
import type { LoyaltyProgram, PromotionTrigger, RewardType } from '../../types'
import { birthdayTierSummary } from '../../lib/tier'
import { TextInput } from '../../components/ui/TextInput'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Select } from '../../components/ui/Select'

// Create/edit form. Seeded from `program` on edit (via key remount in the list).
export function ProgramForm({
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

      <Card className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Program name</span>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="10 Point"
            className="mt-1"
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
            <TextInput
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="10 points get $10 off"
              className="mt-1"
            />
          </label>
        )}
        {/* Trigger: how the reward becomes claimable. */}
        <div className="block">
          <span className="text-sm font-medium text-slate-600">How is it earned?</span>
          <Select<PromotionTrigger>
            value={triggerType}
            onChange={setTriggerType}
            className="mt-1"
            options={[
              { value: 'points', label: 'Points — redeem when the customer has enough points' },
              { value: 'date_window', label: "🎂 Birthday — claimed around the customer's birthday" },
              { value: 'always', label: 'Standing promo — claimable on any visit' },
            ]}
          />
          <span className="mt-1 block text-xs text-slate-400">
            {triggerType === 'points' && 'The customer spends points to redeem this reward.'}
            {triggerType === 'date_window' &&
              'No points needed — claimable once per year inside the birthday window below.'}
            {triggerType === 'always' && 'No points needed — claimable once per year on any visit.'}
          </span>
        </div>

        {/* Points threshold — only for the points trigger. */}
        {triggerType === 'points' && (
          <label className="block">
            <span className="text-sm font-medium text-slate-600">Points per reward</span>
            <TextInput
              type="number"
              value={pointsPerReward}
              onChange={(e) => setPointsPerReward(e.target.value)}
              className="mt-1"
            />
          </label>
        )}

        {/* Claim window — only for date-window (birthday) triggers. */}
        {triggerType === 'date_window' && (
          <div className="grid grid-cols-2 gap-4 rounded-lg bg-pink-50 p-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Days before birthday</span>
              <TextInput
                type="number"
                min={0}
                value={windowBefore}
                onChange={(e) => setWindowBefore(e.target.value)}
                className="mt-1 focus:border-pink-500 focus:ring-pink-200"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Days after birthday</span>
              <TextInput
                type="number"
                min={0}
                value={windowAfter}
                onChange={(e) => setWindowAfter(e.target.value)}
                className="mt-1 focus:border-pink-500 focus:ring-pink-200"
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
            <div className="block">
              <span className="text-sm font-medium text-slate-600">Reward type</span>
              <Select<RewardType>
                value={rewardType}
                onChange={setRewardType}
                className="mt-1"
                options={[
                  { value: 'fixed', label: 'Fixed amount ($)' },
                  { value: 'percent', label: 'Percentage (%)' },
                ]}
              />
            </div>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">
                {rewardType === 'percent' ? 'Reward percentage (%)' : 'Reward amount ($)'}
              </span>
              <TextInput
                type="number"
                value={rewardValue}
                onChange={(e) => setRewardValue(e.target.value)}
                className="mt-1"
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
