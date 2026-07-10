import { useState } from 'react'
import { useSettings, useUpdateSettings } from '../../lib/queries'
import type { AppSettings } from '../../types'

// Admin: app-wide settings. Currently the birthday "highlight" window used to
// flag upcoming-birthday customers with a 🎂 badge in the admin list/detail.
// NOTE: this is a reporting window only — when a birthday *reward* is claimable
// is configured per-program on the Loyalty settings page (date_window trigger).
export function Settings() {
  const { data: settings, isLoading, error } = useSettings()

  if (isLoading) return <p className="text-slate-500">Loading…</p>
  if (error) return <p className="text-red-600">{error.message}</p>
  if (!settings) return null

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <SettingsForm
        key={`${settings.birthdayDaysBefore}-${settings.birthdayDaysAfter}-${settings.birthdayPercentNew}-${settings.birthdayPercentRegular}-${settings.birthdayPercentVip}`}
        settings={settings}
      />
    </div>
  )
}

// Clamp a percent input to 0..100.
function clampPct(v: string): number {
  return Math.min(100, Math.max(0, Number(v) || 0))
}

function SettingsForm({ settings }: { settings: AppSettings }) {
  const update = useUpdateSettings()
  const [before, setBefore] = useState(String(settings.birthdayDaysBefore))
  const [after, setAfter] = useState(String(settings.birthdayDaysAfter))
  const [pctNew, setPctNew] = useState(String(settings.birthdayPercentNew))
  const [pctRegular, setPctRegular] = useState(String(settings.birthdayPercentRegular))
  const [pctVip, setPctVip] = useState(String(settings.birthdayPercentVip))
  const [saved, setSaved] = useState(false)

  const onSave = async () => {
    setSaved(false)
    await update.mutateAsync({
      birthdayDaysBefore: Math.max(0, Number(before) || 0),
      birthdayDaysAfter: Math.max(0, Number(after) || 0),
      birthdayPercentNew: clampPct(pctNew),
      birthdayPercentRegular: clampPct(pctRegular),
      birthdayPercentVip: clampPct(pctVip),
    })
    setSaved(true)
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
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
          <input
            type="number"
            min={0}
            value={before}
            onChange={(e) => setBefore(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Days after</span>
          <input
            type="number"
            min={0}
            value={after}
            onChange={(e) => setAfter(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
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
          <input
            type="number"
            min={0}
            max={100}
            value={pctNew}
            onChange={(e) => setPctNew(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Regular (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            value={pctRegular}
            onChange={(e) => setPctRegular(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-600">VIP (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            value={pctVip}
            onChange={(e) => setPctVip(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={update.isPending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {update.isPending ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="text-sm text-emerald-600">Saved</span>}
        {update.error && <span className="text-sm text-red-600">{update.error.message}</span>}
      </div>
    </div>
  )
}
