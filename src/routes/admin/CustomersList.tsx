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
import { customerTier, tierBadge } from '../../lib/tier'

export function CustomersList() {
  const { data: customers, isLoading, error } = useCustomers()
  const { data: program } = useLoyaltyProgram()
  const { data: settings } = useSettings()
  const [search, setSearch] = useState('')
  const [eligibleOnly, setEligibleOnly] = useState(false)
  const [birthdayOnly, setBirthdayOnly] = useState(false)
  const [page, setPage] = useState(0) // zero-based page index

  // A customer is redeem-eligible (from admin) when their balance is STRICTLY
  // above the lowest active points-program threshold. Admin can't tell whether a
  // point was earned on today's visit, so staff only redeem above the threshold
  // (> N), guaranteeing a point beyond the current cycle. If no active points
  // program has a positive threshold, nobody is eligible.
  const threshold = program?.pointsPerReward ?? null
  const isEligible = (points: number) => threshold != null && points > threshold

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
      // Match on name always; only match on phone when the query has digits
      // (otherwise "".includes('') is always true and every row matches).
      const digits = q.replace(/\D/g, '')
      list = list.filter(
        (c) => c.name.toLowerCase().includes(q) || (digits !== '' && c.phone.includes(digits)),
      )
    }
    if (eligibleOnly && threshold != null) {
      list = list.filter((c) => c.pointsBalance > threshold)
    }
    if (birthdayOnly) {
      list = list.filter((c) => {
        const s = birthdayStatus(c.birthday, c.birthdayRedeemedYear, today, bdayBefore, bdayAfter)
        // Upcoming/today/recent birthdays, not the ones already claimed this year.
        return s !== 'none' && s !== 'claimed'
      })
    }
    return list
    // `today` is a fresh Date each render but only its day matters; the window
    // settings (bdayBefore/After) are the values that actually change results.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, search, eligibleOnly, threshold, birthdayOnly, bdayBefore, bdayAfter])

  const eligibleCount = useMemo(
    () => (threshold == null ? 0 : (customers ?? []).filter((c) => c.pointsBalance > threshold).length),
    [customers, threshold],
  )

  const birthdayCount = useMemo(
    () =>
      (customers ?? []).filter((c) => {
        const s = birthdayStatus(c.birthday, c.birthdayRedeemedYear, today, bdayBefore, bdayAfter)
        return s !== 'none' && s !== 'claimed'
      }).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customers, bdayBefore, bdayAfter],
  )

  // Client-side pagination over the filtered list.
  const PAGE_SIZE = 50
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  // Keep the page in range when the filter shrinks the list.
  const safePage = Math.min(page, pageCount - 1)
  const pageStart = safePage * PAGE_SIZE
  const paged = filtered.slice(pageStart, pageStart + PAGE_SIZE)

  const onExport = () => {
    const rows: (string | number)[][] = [
      [...CSV_HEADERS],
      ...(customers ?? []).map((c) => [
        c.phone,
        c.name,
        c.pointsBalance,
        c.visitCount,
        c.lifetimePoints,
        c.birthday ?? '',
        c.marketingConsent ? 1 : 0,
        c.lastVisitAt ?? '',
      ]),
    ]
    downloadCsv('customers.csv', toCsv(rows))
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
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
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
          placeholder="Search by name or phone…"
          className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        />
        {threshold != null && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={eligibleOnly}
              onChange={(e) => {
                setEligibleOnly(e.target.checked)
                setPage(0)
              }}
              className="h-4 w-4 accent-emerald-600"
            />
            Redeem-eligible only
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              {eligibleCount}
            </span>
          </label>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={birthdayOnly}
            onChange={(e) => {
              setBirthdayOnly(e.target.checked)
              setPage(0)
            }}
            className="h-4 w-4 accent-pink-600"
          />
          🎂 Birthday soon
          <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-700">
            {birthdayCount}
          </span>
        </label>
      </div>

      {isLoading && <p className="text-slate-500">Loading customers…</p>}
      {error && <p className="text-red-600">{error.message}</p>}

      {!isLoading && !error && (
        <p className="mb-2 text-sm text-slate-500">
          Showing <span className="font-medium text-slate-700">{pageStart + paged.length}</span> of{' '}
          <span className="font-medium text-slate-700">{filtered.length}</span>
          {filtered.length !== (customers?.length ?? 0) && ` (of ${customers?.length ?? 0} total)`}
        </p>
      )}

      {!isLoading && !error && (
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm lg:min-w-[720px]">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-slate-500 shadow-sm">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Phone</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">DoB</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Last visited</th>
                <th className="px-4 py-3 font-medium">Points</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Lifetime points</th>
                <th className="px-4 py-3 font-medium">Visits</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((c) => {
                const eligible = isEligible(c.pointsBalance)
                const bday = bdayStatus(c.birthday, c.birthdayRedeemedYear)
                const badge = birthdayStatusBadge(bday)
                // Highlight the row while an unclaimed birthday is in-window.
                const bdayActive = bday !== 'none' && bday !== 'claimed'
                const tier = customerTier(c.lifetimePoints)
                const tBadge = tier ? tierBadge(tier) : null
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
                    <td className="px-4 py-3 align-top">
                      <Link to={`/admin/customers/${c.id}`} className="font-medium text-brand-700 hover:underline">
                        {c.name}
                      </Link>
                      {tBadge && (
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${tBadge.className}`}
                        >
                          {tBadge.label}
                        </span>
                      )}
                      {/* Consolidated (below lg): phone + DoB stacked under the name. */}
                      <div className="mt-1 space-y-0.5 text-xs text-slate-500 lg:hidden">
                        <div>{formatPhone(c.phone)}</div>
                        <div className="flex items-center gap-1">
                          <span>🎂 {formatBirthday(c.birthday)}</span>
                          {badge && (
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 align-top text-slate-600 lg:table-cell">{formatPhone(c.phone)}</td>
                    <td className="hidden px-4 py-3 align-top lg:table-cell">
                      <span className="text-slate-600">{formatBirthday(c.birthday)}</span>
                      {badge && (
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 align-top text-slate-600 lg:table-cell">
                      {c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {/* Desktop (lg+): just the current balance (Lifetime is its own column). */}
                      <span className="hidden text-slate-600 lg:inline">{c.pointsBalance}</span>
                      {eligible && (
                        <span className="ml-2 hidden rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 lg:inline-block">
                          🎁 Redeemable
                        </span>
                      )}
                      {/* Consolidated (below lg): current + lifetime, each labelled. */}
                      <div className="space-y-0.5 text-xs lg:hidden">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-600">
                            <span className="text-slate-400">Current </span>
                            {c.pointsBalance}
                          </span>
                          {eligible && (
                            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                              🎁
                            </span>
                          )}
                        </div>
                        <div className="text-slate-600">
                          <span className="text-slate-400">Lifetime </span>
                          {c.lifetimePoints}
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 align-top text-slate-600 lg:table-cell">{c.lifetimePoints}</td>
                    <td className="px-4 py-3 align-top text-slate-600">
                      {/* Desktop: just the visit count (Last visited is its own column at lg+). */}
                      <span className="hidden lg:inline">{c.visitCount}</span>
                      {/* Mobile/tablet: count + last visited, each labelled. */}
                      <div className="space-y-0.5 text-xs lg:hidden">
                        <div>
                          <span className="text-slate-400">Count </span>
                          {c.visitCount}
                        </div>
                        <div>
                          <span className="text-slate-400">Last visited </span>
                          {c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString() : '—'}
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && !error && filtered.length > 0 && pageCount > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-1 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            ← Prev
          </button>
          {pageNumbers(safePage, pageCount).map((n, i) =>
            n === ELLIPSIS ? (
              <span key={`e${i}`} className="px-2 py-1.5 text-slate-400">
                …
              </span>
            ) : (
              <button
                key={n}
                onClick={() => setPage(n)}
                aria-current={n === safePage ? 'page' : undefined}
                className={
                  'min-w-9 rounded-lg border px-3 py-1.5 font-medium ' +
                  (n === safePage
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50')
                }
              >
                {n + 1}
              </button>
            ),
          )}
          <button
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={safePage >= pageCount - 1}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

// Sentinel for a gap in the page list.
const ELLIPSIS = -1

// Build a compact page list around the current page: always the first and last
// page, the current ±1, and ellipsis sentinels for the gaps. Zero-based indices.
function pageNumbers(current: number, count: number): number[] {
  const pages = new Set<number>([0, count - 1, current])
  if (current - 1 > 0) pages.add(current - 1)
  if (current + 1 < count - 1) pages.add(current + 1)
  const sorted = [...pages].filter((n) => n >= 0 && n < count).sort((a, b) => a - b)

  const out: number[] = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push(ELLIPSIS)
    out.push(sorted[i])
  }
  return out
}
