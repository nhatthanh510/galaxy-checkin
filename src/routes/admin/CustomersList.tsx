import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCustomers, useLoyaltyProgram, useSettings } from '../../lib/queries'
import { CSV_HEADERS, downloadCsv, toCsv } from '../../lib/csv'
import { formatPhone } from '../../lib/phone'
import {
  birthdayStatus,
  birthdayStatusBadge,
  formatBirthday,
} from '../../lib/birthday'

export function CustomersList() {
  const { data: customers, isLoading, error } = useCustomers()
  const { data: program } = useLoyaltyProgram()
  const { data: settings } = useSettings()
  const [search, setSearch] = useState('')
  const [eligibleOnly, setEligibleOnly] = useState(false)

  // A customer is redeem-eligible when their balance meets the active program's
  // threshold. If there's no active program, nobody is eligible.
  const threshold = program?.pointsPerReward ?? null
  const isEligible = (points: number) => threshold != null && points >= threshold

  // Birthday status for a customer, using the configured window (default 7/7).
  const today = new Date()
  const bdayBefore = settings?.birthdayDaysBefore ?? 7
  const bdayAfter = settings?.birthdayDaysAfter ?? 7
  const bdayStatus = (b: string | null, redeemedYear: number | null) =>
    birthdayStatus(b, redeemedYear, today, bdayBefore, bdayAfter)

  const filtered = useMemo(() => {
    let list = customers ?? []
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q.replace(/\D/g, '')),
      )
    }
    if (eligibleOnly && threshold != null) {
      list = list.filter((c) => c.pointsBalance >= threshold)
    }
    return list
  }, [customers, search, eligibleOnly, threshold])

  const eligibleCount = useMemo(
    () => (threshold == null ? 0 : (customers ?? []).filter((c) => c.pointsBalance >= threshold).length),
    [customers, threshold],
  )

  const onExport = () => {
    const rows: (string | number)[][] = [
      [...CSV_HEADERS],
      ...(customers ?? []).map((c) => [c.phone, c.name, c.pointsBalance, c.visitCount]),
    ]
    downloadCsv('customers.csv', toCsv(rows))
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Customers</h1>
        <div className="flex gap-2">
          <Link
            to="/admin/customers/import"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500"
          >
            Import CSV
          </Link>
          <button
            onClick={onExport}
            disabled={!customers?.length}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone…"
          className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        />
        {threshold != null && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={eligibleOnly}
              onChange={(e) => setEligibleOnly(e.target.checked)}
              className="h-4 w-4 accent-emerald-600"
            />
            Redeem-eligible only
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              {eligibleCount}
            </span>
          </label>
        )}
      </div>

      {isLoading && <p className="text-slate-500">Loading customers…</p>}
      {error && <p className="text-red-600">{error.message}</p>}

      {!isLoading && !error && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">DoB</th>
                <th className="px-4 py-3 font-medium">Points</th>
                <th className="px-4 py-3 font-medium">Visits</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const eligible = isEligible(c.pointsBalance)
                const bday = bdayStatus(c.birthday, c.birthdayRedeemedYear)
                const badge = birthdayStatusBadge(bday)
                // Highlight the row while an unclaimed birthday is in-window.
                const bdayActive = bday !== 'none' && bday !== 'claimed'
                return (
                  <tr
                    key={c.id}
                    className={
                      'border-b border-slate-100 last:border-0 ' +
                      (bdayActive
                        ? 'bg-pink-50 hover:bg-pink-100'
                        : eligible
                          ? 'bg-emerald-50 hover:bg-emerald-100'
                          : 'hover:bg-slate-50')
                    }
                  >
                    <td className="px-4 py-3">
                      <Link to={`/admin/customers/${c.id}`} className="font-medium text-brand-700 hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatPhone(c.phone)}</td>
                    <td className="px-4 py-3">
                      <span className="text-slate-600">{formatBirthday(c.birthday)}</span>
                      {badge && (
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-600">{c.pointsBalance}</span>
                      {eligible && (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          🎁 Redeemable
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.visitCount}</td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
