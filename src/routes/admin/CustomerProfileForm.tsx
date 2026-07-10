import { useEffect, useState } from 'react'
import {
  useUpdateCustomer,
  useActiveLoyaltyPrograms,
  useRedeemPoints,
  useClaimBirthday,
  useSettings,
} from '../../lib/queries'
import type { Customer, LoyaltyProgram } from '../../types'
import { formatReward } from '../../lib/reward'
import { BirthdayDropdowns } from '../../components/BirthdayDropdowns'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { TextInput } from '../../components/ui/TextInput'
import {
  dateStringToParts,
  formatBirthday,
  partsToDateString,
  shouldRemindBirthday,
} from '../../lib/birthday'

// Editable profile form, seeded directly from props (no effect). The parent
// gates on load and keys this by customer id so it re-initializes per customer.
export function ProfileForm({ customer }: { customer: Customer }) {
  const update = useUpdateCustomer()
  const { data: programs } = useActiveLoyaltyPrograms()
  const { data: settings } = useSettings()
  const redeem = useRedeemPoints()
  const claimBirthday = useClaimBirthday()
  const [name, setName] = useState(customer.name)
  const [points, setPoints] = useState(String(customer.pointsBalance))
  const [lifetimePoints, setLifetimePoints] = useState(String(customer.lifetimePoints))
  const [birthday, setBirthday] = useState(dateStringToParts(customer.birthday))
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [redeemedMsg, setRedeemedMsg] = useState<string | null>(null)
  const [bdayClaimed, setBdayClaimed] = useState(false)

  // Auto-dismiss the save/redeem confirmations after a few seconds (matches the
  // Settings page).
  useEffect(() => {
    if (!savedMsg) return
    const t = setTimeout(() => setSavedMsg(null), 3000)
    return () => clearTimeout(t)
  }, [savedMsg])
  useEffect(() => {
    if (!redeemedMsg) return
    const t = setTimeout(() => setRedeemedMsg(null), 3000)
    return () => clearTimeout(t)
  }, [redeemedMsg])

  // Is the form changed from the saved customer? Save is disabled when not, so
  // clicking Save with no edits does nothing (no needless write).
  const dirty =
    name.trim() !== customer.name ||
    (Number(points) || 0) !== customer.pointsBalance ||
    (Number(lifetimePoints) || 0) !== customer.lifetimePoints ||
    partsToDateString(birthday) !== customer.birthday
  // Confirmation popover shown before claiming a birthday (guards accidental
  // clicks; a first-visit customer also gets a stronger warning inside).
  const [confirmingBday, setConfirmingBday] = useState(false)
  // The points program pending a redeem confirmation, or null when closed.
  const [confirmingRedeem, setConfirmingRedeem] = useState<LoyaltyProgram | null>(null)
  // Live balance for eligibility (updates after each redeem without a refetch).
  const [balance, setBalance] = useState(customer.pointsBalance)
  const currentYear = new Date().getFullYear()

  // Birthday claim availability: in the window and not yet claimed this year.
  const bdayRemind =
    settings != null &&
    shouldRemindBirthday(
      customer.birthday,
      customer.birthdayRedeemedYear,
      new Date(),
      settings.birthdayDaysBefore,
      settings.birthdayDaysAfter,
    ) &&
    !bdayClaimed

  // A customer's birthday reward opens from their SECOND visit — a first-timer
  // who just entered a birthday near today shouldn't claim it on sign-up. Mirror
  // the kiosk rule (useEligiblePromotions) here, as a guard, not a hard block.
  const birthdayFirstVisitOnly = customer.visitCount < 2

  // Run the actual claim (called directly for returning customers, or from the
  // confirmation popover for first-visit customers).
  const doClaimBirthday = async () => {
    await claimBirthday.mutateAsync(customer.id)
    setBdayClaimed(true)
    setConfirmingBday(false)
  }

  // Always confirm before claiming (guards accidental clicks). The popover shows
  // an extra warning for a first-visit customer.
  const onClaimBirthday = () => setConfirmingBday(true)

  const onSave = async () => {
    if (!dirty) return
    setSavedMsg(null)
    const updated = await update.mutateAsync({
      id: customer.id,
      name: name.trim(),
      pointsBalance: Number(points) || 0,
      birthday: partsToDateString(birthday),
      lifetimePoints: Number(lifetimePoints) || 0,
    })
    // Reflect the saved values so the section recomputes.
    setBalance(updated.pointsBalance)
    setPoints(String(updated.pointsBalance))
    setLifetimePoints(String(updated.lifetimePoints))
    setSavedMsg(`${updated.name}'s profile updated`)
  }

  // Points-triggered programs the customer can redeem from admin. Redeemable at
  // the threshold (>= N): a customer with exactly N points can redeem an N-point
  // reward, matching the kiosk. Date-window/standing promos aren't points-
  // redeemable — the birthday claim has its own control below.
  const eligiblePrograms = (programs ?? []).filter(
    (p) => p.triggerType === 'points' && balance >= p.pointsPerReward,
  )

  // Clicking Redeem opens a confirm popover (guards accidental clicks); the
  // actual redeem runs on confirm.
  const onRedeem = (program: LoyaltyProgram) => {
    setRedeemedMsg(null)
    setConfirmingRedeem(program)
  }

  const doRedeem = async () => {
    const program = confirmingRedeem
    if (!program) return
    const result = await redeem.mutateAsync({
      customerId: customer.id,
      programId: program.id,
    })
    setBalance(result.pointsBalance)
    setPoints(String(result.pointsBalance))
    setRedeemedMsg(
      `Redeemed ${result.redeemedPoints} points from "${program.name}" for ${formatReward(result.rewardType, result.rewardValue)}. New balance: ${result.pointsBalance}.`,
    )
    setConfirmingRedeem(null)
  }

  return (
    <Card className="mt-6">
      <h2 className="mb-4 text-lg font-semibold">Profile</h2>
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Name</span>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Points balance</span>
          <TextInput
            type="number"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            className="mt-1"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Lifetime points</span>
          <TextInput
            type="number"
            value={lifetimePoints}
            onChange={(e) => setLifetimePoints(e.target.value)}
            className="mt-1"
          />
          <span className="mt-1 block text-xs text-slate-400">Total earned (drives tier).</span>
        </label>
      </div>
      <div className="mt-4">
        <span className="text-sm font-medium text-slate-600">
          Birthday <span className="font-normal text-slate-400">({formatBirthday(customer.birthday)})</span>
        </span>
        <div className="mt-1">
          <BirthdayDropdowns value={birthday} onChange={setBirthday} variant="light" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={onSave} disabled={update.isPending || !dirty}>
          {update.isPending ? 'Saving…' : 'Save'}
        </Button>
        {!dirty && !savedMsg && !update.isPending && (
          <span className="text-sm text-slate-400">No changes to save</span>
        )}
        {savedMsg && <span className="text-sm font-medium text-emerald-600">✓ {savedMsg}</span>}
        {update.error && <span className="text-sm text-red-600">{update.error.message}</span>}
      </div>

      {/* Redeem rewards (staff-applied) — one button per eligible program. */}
      <div className="mt-6 border-t border-slate-100 pt-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-600">
          Redeemable rewards <span className="font-normal text-slate-400">({balance} pts)</span>
        </h3>
        {eligiblePrograms.length === 0 ? (
          <p className="text-sm text-slate-400">
            {(programs ?? []).length === 0
              ? 'No active loyalty program.'
              : 'Not enough points for any reward yet.'}
          </p>
        ) : (
          <div className="space-y-2">
            {eligiblePrograms.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <button
                  onClick={() => onRedeem(p)}
                  disabled={redeem.isPending}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {redeem.isPending ? 'Redeeming…' : `Redeem ${p.name}`}
                </button>
                <span className="text-sm text-slate-500">
                  {p.pointsPerReward} pts → {formatReward(p.rewardType, p.rewardValue)}
                </span>
              </div>
            ))}
          </div>
        )}
        {redeemedMsg && <p className="mt-2 text-sm text-emerald-600">{redeemedMsg}</p>}
        {redeem.error && <p className="mt-2 text-sm text-red-600">{redeem.error.message}</p>}
        <ConfirmDialog
          open={confirmingRedeem != null}
          title="Redeem this reward?"
          message={
            confirmingRedeem && (
              <>
                Redeem <span className="font-semibold text-slate-800">{confirmingRedeem.name}</span>{' '}
                for <span className="font-semibold text-slate-800">{customer.name}</span>? This spends{' '}
                {confirmingRedeem.pointsPerReward} points (
                {formatReward(confirmingRedeem.rewardType, confirmingRedeem.rewardValue)}) and can't be
                undone.
              </>
            )
          }
          confirmLabel="Redeem"
          busy={redeem.isPending}
          error={redeem.error?.message ?? null}
          onConfirm={doRedeem}
          onCancel={() => setConfirmingRedeem(null)}
        />
      </div>

      {/* Birthday discount — mark used this year (hides the reminder). Allowed
          even on a first visit, but a warning + confirm popover guards it. */}
      {bdayRemind && (
        <div className="mt-6 border-t border-slate-100 pt-4">
          {birthdayFirstVisitOnly && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              ⚠️ This is the customer's first visit. The birthday reward is meant for
              returning customers (2nd visit onward) — you can still claim it, but you'll be
              asked to confirm.
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={onClaimBirthday}
              disabled={claimBirthday.isPending}
              className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-500 disabled:opacity-50"
            >
              {claimBirthday.isPending ? 'Marking…' : '🎂 Mark birthday discount used'}
            </button>
            <span className="text-sm text-slate-500">
              Records the birthday benefit as claimed for {currentYear}.
            </span>
          </div>
          {claimBirthday.error && (
            <p className="mt-2 text-sm text-red-600">{claimBirthday.error.message}</p>
          )}
          <ConfirmDialog
            open={confirmingBday}
            title={
              birthdayFirstVisitOnly
                ? 'Claim birthday reward on first visit?'
                : 'Mark birthday discount as used?'
            }
            message={
              birthdayFirstVisitOnly ? (
                <>
                  ⚠️ <span className="font-semibold text-slate-800">{customer.name}</span> has only
                  visited once. The birthday reward is normally for returning customers (2nd visit
                  onward). Claim it anyway for {currentYear}?
                </>
              ) : (
                <>
                  Record the birthday benefit for{' '}
                  <span className="font-semibold text-slate-800">{customer.name}</span> as claimed
                  for {currentYear}? This hides the birthday reminder until next year.
                </>
              )
            }
            confirmLabel={birthdayFirstVisitOnly ? 'Claim anyway' : 'Mark as used'}
            busy={claimBirthday.isPending}
            error={claimBirthday.error?.message ?? null}
            onConfirm={doClaimBirthday}
            onCancel={() => setConfirmingBday(false)}
          />
        </div>
      )}
      {bdayClaimed && (
        <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-pink-600">
          🎉 Birthday discount marked as used for {currentYear}.
        </p>
      )}
    </Card>
  )
}
