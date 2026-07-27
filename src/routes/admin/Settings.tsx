import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSettings, useUpdateSettings } from '../../lib/queries'
import type { AppSettings } from '../../types'
import { TextInput } from '../../components/ui/TextInput'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { FormSkeleton } from '../../components/ui/Skeleton'

// Admin: app-wide settings. Currently the birthday "highlight" window used to
// flag upcoming-birthday customers with a 🎂 badge in the admin list/detail.
// NOTE: this is a reporting window only — when a birthday *reward* is claimable
// is configured per-program on the Loyalty settings page (date_window trigger).
export function Settings() {
  const { data: settings, isLoading, error } = useSettings()

  if (isLoading) return <FormSkeleton fields={5} />
  if (error) return <p className="text-red-600">{error.message}</p>
  if (!settings) return null

  // NOTE: no volatile `key` here. Keying the form on the settings values made a
  // successful save (which refetches new values) remount the form and wipe its
  // "Saved" confirmation before it could show. The form seeds from `settings` on
  // mount and owns its edits, so a stable identity is correct.
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <SettingsForm settings={settings} />
    </div>
  )
}

// Clamp a percent input to 0..100.
function clampPct(v: string): number {
  return Math.min(100, Math.max(0, Number(v) || 0))
}

// Clamp an integer input to [min, max] (matches the DB check constraints).
function clampInt(v: string, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(Number(v) || 0)))
}

function SettingsForm({ settings }: { settings: AppSettings }) {
  const update = useUpdateSettings()
  const [before, setBefore] = useState(String(settings.birthdayDaysBefore))
  const [after, setAfter] = useState(String(settings.birthdayDaysAfter))
  const [pctNew, setPctNew] = useState(String(settings.birthdayPercentNew))
  const [pctRegular, setPctRegular] = useState(String(settings.birthdayPercentRegular))
  const [pctVip, setPctVip] = useState(String(settings.birthdayPercentVip))
  const [tierWindow, setTierWindow] = useState(String(settings.tierWindowMonths))
  const [tierVipMin, setTierVipMin] = useState(String(settings.tierVipMinVisits))
  const [tierRegMin, setTierRegMin] = useState(String(settings.tierRegularMinVisits))
  const [saved, setSaved] = useState(false)

  // Auto-dismiss the "Saved" confirmation after a few seconds.
  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 3000)
    return () => clearTimeout(t)
  }, [saved])

  // Normalized values the Save would write, compared to what's stored — so Save
  // is disabled when nothing changed (no needless write).
  const nextValues: AppSettings = {
    birthdayDaysBefore: Math.max(0, Number(before) || 0),
    birthdayDaysAfter: Math.max(0, Number(after) || 0),
    birthdayPercentNew: clampPct(pctNew),
    birthdayPercentRegular: clampPct(pctRegular),
    birthdayPercentVip: clampPct(pctVip),
    tierWindowMonths: clampInt(tierWindow, 1, 60),
    tierVipMinVisits: clampInt(tierVipMin, 0, 1000),
    tierRegularMinVisits: clampInt(tierRegMin, 0, 1000),
  }

  // Decay state from the SAVED settings (both thresholds 0 = paused), so the badge
  // reflects what's actually in effect and only flips after a successful Save —
  // matching the Tier changes page (which also reads the saved settings).
  const tierPaused = settings.tierVipMinVisits === 0 && settings.tierRegularMinVisits === 0
  const dirty = (Object.keys(nextValues) as (keyof AppSettings)[]).some(
    (k) => nextValues[k] !== settings[k],
  )

  const onSave = async () => {
    if (!dirty) return
    setSaved(false)
    await update.mutateAsync(nextValues)
    setSaved(true)
  }

  return (
    <Card className="mt-6">
      <h2 className="text-lg font-semibold">Birthday highlight window</h2>
      <p className="mt-1 text-sm text-slate-500">
        Flags customers with a 🎂 badge in the admin customer list and detail when their
        birthday falls within this window of today. This is for staff visibility only —
        it does <span className="font-medium">not</span> control when a birthday reward can
        be claimed (that's set per-program on the Loyalty settings page).
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Days before</span>
          <TextInput
            type="number"
            min={0}
            value={before}
            onChange={(e) => setBefore(e.target.value)}
            className="mt-1"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Days after</span>
          <TextInput
            type="number"
            min={0}
            value={after}
            onChange={(e) => setAfter(e.target.value)}
            className="mt-1"
          />
        </label>
      </div>

      <h2 className="mt-8 text-lg font-semibold">Birthday discount by tier</h2>
      <p className="mt-1 text-sm text-slate-500">
        The birthday reward's percent off is chosen by the customer's loyalty tier
        (derived from lifetime points: New &lt; 5, Regular 5–19, VIP ≥ 20). The kiosk and
        the birthday SMS both show the tier's percent, so staff and admins see exactly
        what each customer gets.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-600">New (%)</span>
          <TextInput
            type="number"
            min={0}
            max={100}
            value={pctNew}
            onChange={(e) => setPctNew(e.target.value)}
            className="mt-1"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Regular (%)</span>
          <TextInput
            type="number"
            min={0}
            max={100}
            value={pctRegular}
            onChange={(e) => setPctRegular(e.target.value)}
            className="mt-1"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-600">VIP (%)</span>
          <TextInput
            type="number"
            min={0}
            max={100}
            value={pctVip}
            onChange={(e) => setPctVip(e.target.value)}
            className="mt-1"
          />
        </label>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Tier maintenance</h2>
        {tierPaused ? (
          <span
            className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200"
            title="Both visit thresholds are 0, so the monthly review downgrades no one."
          >
            ⏸ Decay paused
          </span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
            ● Active
          </span>
        )}
        <Link
          to="/admin/tier-changes"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline sm:ml-auto"
        >
          <span aria-hidden>📊</span> Tier changes
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Tiers are earned from lifetime points but <span className="font-medium">kept</span> by
        recent activity. A monthly review drops a customer one tier level when they have too
        few visits in the trailing window: fewer than the VIP threshold takes VIP → Regular,
        fewer than the Regular threshold takes Regular → New.{' '}
        <span className="font-medium">Both thresholds default to 0, which pauses automatic
        decay</span> — raise them (e.g. VIP 5 / Regular 3) once you have enough real check-in
        history to trust visit counts. You can always run it manually from the Tier changes page.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Window (months)</span>
          <TextInput
            type="number"
            min={1}
            max={60}
            value={tierWindow}
            onChange={(e) => setTierWindow(e.target.value)}
            className="mt-1"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-600">VIP min visits</span>
          <TextInput
            type="number"
            min={0}
            max={1000}
            value={tierVipMin}
            onChange={(e) => setTierVipMin(e.target.value)}
            className="mt-1"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Regular min visits</span>
          <TextInput
            type="number"
            min={0}
            max={1000}
            value={tierRegMin}
            onChange={(e) => setTierRegMin(e.target.value)}
            className="mt-1"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={onSave} disabled={update.isPending || !dirty}>
          {update.isPending ? 'Saving…' : 'Save'}
        </Button>
        {!dirty && !saved && !update.isPending && (
          <span className="text-sm text-slate-400">No changes to save</span>
        )}
        {saved && !update.isPending && (
          <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
            ✓ Settings saved
          </span>
        )}
        {update.error && <span className="text-sm text-red-600">{update.error.message}</span>}
      </div>
    </Card>
  )
}
