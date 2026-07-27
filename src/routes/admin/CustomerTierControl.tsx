import { useState } from 'react'
import type { AppSettings, CheckinHistoryItem, Customer, CustomerTier } from '../../types'
import { useSetTier } from '../../lib/queries'
import { tierName } from '../../lib/tier'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Select, type SelectOption } from '../../components/ui/Select'

const TIER_OPTIONS: SelectOption<CustomerTier>[] = [
  { value: 'new', label: 'New' },
  { value: 'regular', label: 'Regular' },
  { value: 'vip', label: 'VIP' },
]

// Admin: manual tier override + maintenance status for one customer. Shows how
// many visits they have in the trailing window and whether a decay is due
// (unless locked), and lets an admin pin a tier that the automatic flow skips.
export function CustomerTierControl({
  customer,
  checkins,
  settings,
}: {
  customer: Customer
  checkins: CheckinHistoryItem[]
  settings: AppSettings | undefined
}) {
  const setTier = useSetTier()
  const [tier, setTierValue] = useState<CustomerTier>(customer.tier)
  const [locked, setLocked] = useState(customer.tierLocked)

  const dirty = tier !== customer.tier || locked !== customer.tierLocked

  // Visits in the trailing window, computed from the already-loaded history —
  // the "why / when a decay happens" context. setMonth mirrors the SQL
  // make_interval(months => N) closely enough for a display hint.
  const windowMonths = settings?.tierWindowMonths ?? 6
  const windowStart = new Date()
  windowStart.setMonth(windowStart.getMonth() - windowMonths)
  const visits = checkins.filter(
    (c) => c.status !== 'cancelled' && new Date(c.createdAt) >= windowStart,
  ).length

  // Visits needed to KEEP the current tier (New can't decay, so 0).
  const needed =
    customer.tier === 'vip'
      ? (settings?.tierVipMinVisits ?? 5)
      : customer.tier === 'regular'
        ? (settings?.tierRegularMinVisits ?? 3)
        : 0
  const atRisk = !customer.tierLocked && needed > 0 && visits < needed

  const onSave = () => {
    if (!dirty) return
    setTier.mutate({ id: customer.id, tier, locked })
  }

  return (
    <Card className="mt-6">
      <h2 className="text-lg font-semibold">Tier</h2>

      {customer.tierLocked ? (
        <p className="mt-1 text-sm text-amber-700">
          🔒 Tier locked — this customer is exempt from automatic changes.
        </p>
      ) : (
        <p className="mt-1 text-sm text-slate-500">
          {visits} visit{visits === 1 ? '' : 's'} in the last {windowMonths} month
          {windowMonths === 1 ? '' : 's'}.
          {needed > 0 && (
            <>
              {' '}
              Needs {needed} to keep {tierName(customer.tier)}.
            </>
          )}
          {atRisk && (
            <span className="font-medium text-amber-700">
              {' '}
              ⚠ Below threshold — will drop a level at the next review.
            </span>
          )}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Tier</span>
          <Select<CustomerTier>
            value={tier}
            options={TIER_OPTIONS}
            onChange={setTierValue}
            className="mt-1 w-40"
            aria-label="Customer tier"
          />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={locked}
            onChange={(e) => setLocked(e.target.checked)}
            className="h-4 w-4"
          />
          Lock tier (exempt from automatic changes)
        </label>
        <Button onClick={onSave} disabled={setTier.isPending || !dirty}>
          {setTier.isPending ? 'Saving…' : 'Save'}
        </Button>
        {setTier.isSuccess && !dirty && !setTier.isPending && (
          <span className="pb-2 text-sm font-medium text-emerald-600">✓ Tier saved</span>
        )}
        {setTier.error && (
          <span className="pb-2 text-sm text-red-600">{setTier.error.message}</span>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Setting a tier here is a manual override. Left unlocked, the automatic flow (decay on
        the monthly review, upgrades at check-in) can move it again — lock it to pin it.
      </p>
    </Card>
  )
}
