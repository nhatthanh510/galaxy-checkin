import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCheckinsReport, useBranches } from '../../lib/queries'
import type { CheckinReportRow } from '../../lib/queries'
import { localDateFromInput, toDateInputValue } from '../../lib/day'
import { formatPhone } from '../../lib/phone'
import { customerTier, tierBadge } from '../../lib/tier'
import { Select } from '../../components/ui/Select'
import { TextInput } from '../../components/ui/TextInput'
import { Pagination } from '../../components/Pagination'
import { usePagination } from '../../components/usePagination'
import { DateChip } from './customersListParts'

// Sentinel branch-filter values (the Select needs string values).
const ALL = '__all__'
const UNASSIGNED = '__unassigned__'
const PAGE_SIZE = 25

// Date-range mode for the report.
type DateMode = 'today' | 'yesterday' | '7d' | 'all' | 'custom'

const isSameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

// Admin: the check-ins report — an ACTIVITY view (distinct from the customer
// list, which is one row per person). Pick a date range and see every visit in a
// paginated table: a customer who came several times appears once per visit. Day
// separators break up the rows so it still reads as an activity feed. Search by
// name/phone, filter by branch, with per-branch stat tiles.
export function DailyCheckins() {
  const dayOffset = (days: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d
  }
  // The selected date mode drives what range is queried. 'all' fetches every
  // check-in (no date bounds); the presets set a range; 'custom' reveals the
  // from/to pickers. Default: today.
  const [mode, setMode] = useState<DateMode>('today')
  // Custom-range bounds (only used in 'custom' mode). Seeded to the last 7 days.
  const [customFrom, setCustomFrom] = useState<Date>(() => dayOffset(-6))
  const [customTo, setCustomTo] = useState<Date>(() => dayOffset(0))
  const [branchFilter, setBranchFilter] = useState<string>(ALL)
  const [search, setSearch] = useState('')

  // Resolve the mode to the [from, to] the hook wants. null/null = All.
  const { from, to } = useMemo<{ from: Date | null; to: Date | null }>(() => {
    if (mode === 'all') return { from: null, to: null }
    if (mode === 'today') return { from: dayOffset(0), to: dayOffset(0) }
    if (mode === 'yesterday') return { from: dayOffset(-1), to: dayOffset(-1) }
    if (mode === '7d') return { from: dayOffset(-6), to: dayOffset(0) }
    return { from: customFrom, to: customTo } // 'custom'
  }, [mode, customFrom, customTo])

  const { data: rows, isLoading, error } = useCheckinsReport(from, to)
  const { data: branches } = useBranches(true)

  // Rows after branch + search filters.
  const visible = useMemo(() => {
    let list = rows ?? []
    if (branchFilter === UNASSIGNED) list = list.filter((r) => r.branchId == null)
    else if (branchFilter !== ALL) list = list.filter((r) => r.branchId === branchFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      const digits = q.replace(/\D/g, '')
      list = list.filter(
        (r) =>
          r.customerName.toLowerCase().includes(q) ||
          (digits !== '' && r.customerPhone.includes(digits)),
      )
    }
    return list
  }, [rows, branchFilter, search])

  // Per-branch counts across the whole range (independent of the branch filter),
  // so the stat tiles always show the full breakdown. Unassigned = null branch.
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    let unassigned = 0
    for (const r of rows ?? []) {
      if (r.branchId == null) unassigned++
      else map.set(r.branchId, (map.get(r.branchId) ?? 0) + 1)
    }
    return { map, unassigned }
  }, [rows])

  const { page, pageCount, pageItems, setPage, canPrev, canNext, total } = usePagination(
    visible,
    PAGE_SIZE,
  )
  const pageStart = page * PAGE_SIZE

  const dayKey = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  }
  // Per-day visit counts within the current page, shown on each day header.
  const pageDayCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of pageItems) m.set(dayKey(r.createdAt), (m.get(dayKey(r.createdAt)) ?? 0) + 1)
    return m
  }, [pageItems])

  const branchOptions = [
    { value: ALL, label: 'All branches' },
    ...(branches ?? []).map((b) => ({ value: b.id, label: b.name })),
    { value: UNASSIGNED, label: 'Unassigned' },
  ]

  // Reset to page 1 when filters/range change (usePagination clamps, but this
  // snaps back to the top rather than the last valid page of a shorter list).
  const resetKey = `${from ? toDateInputValue(from) : 'all'}|${
    to ? toDateInputValue(to) : 'all'
  }|${branchFilter}|${search}`
  const [lastResetKey, setLastResetKey] = useState(resetKey)
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey)
    setPage(0)
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Check-in activity</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every check-in — who checked in, when, and at which branch.
        </p>
      </div>

      {/* Stat tiles: total + per-branch + unassigned. ALWAYS rendered with the
          same tile set (Unassigned included even at 0) and a fixed tile height, so
          neither loading nor a changing count shifts the layout below. During load
          the values show a skeleton bar instead of numbers. */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile
          label="Total check-ins"
          value={rows?.length ?? 0}
          accent="brand"
          loading={isLoading}
        />
        {(branches ?? []).map((b, i) => (
          <StatTile
            key={b.id}
            label={b.name}
            value={counts.map.get(b.id) ?? 0}
            accent={BRANCH_ACCENTS[i % BRANCH_ACCENTS.length]}
            loading={isLoading}
          />
        ))}
        <StatTile label="Unassigned" value={counts.unassigned} accent="slate" loading={isLoading} />
      </div>

      {/* Row 1: search + branch. Stacks on narrow widths. */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <TextInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone…"
          className="w-full sm:max-w-xs"
        />
        <Select
          value={branchFilter}
          aria-label="Filter by branch"
          options={branchOptions}
          onChange={setBranchFilter}
          className="w-full sm:ml-auto sm:w-44"
        />
      </div>

      {/* Row 2: date filter on its own line (tidier on tablet). Preset modes +
          the from/to pickers (Custom mode only). */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-300">
          <DateChip active={mode === 'today'} onClick={() => setMode('today')}>
            Today
          </DateChip>
          <DateChip active={mode === 'yesterday'} onClick={() => setMode('yesterday')} bordered>
            Yesterday
          </DateChip>
          <DateChip active={mode === '7d'} onClick={() => setMode('7d')} bordered>
            7 days
          </DateChip>
          <DateChip active={mode === 'all'} onClick={() => setMode('all')} bordered>
            All
          </DateChip>
          <DateChip active={mode === 'custom'} onClick={() => setMode('custom')} bordered>
            Custom
          </DateChip>
        </div>
        {/* From/to pickers appear only in Custom mode. */}
        {mode === 'custom' && (
          <div className="flex w-full items-center gap-1.5 text-sm text-slate-500 sm:w-auto">
            <input
              type="date"
              value={toDateInputValue(customFrom)}
              max={toDateInputValue(customTo)}
              onChange={(e) => {
                const d = localDateFromInput(e.target.value)
                if (d) setCustomFrom(d)
              }}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 sm:flex-none"
            />
            <span>–</span>
            <input
              type="date"
              value={toDateInputValue(customTo)}
              min={toDateInputValue(customFrom)}
              onChange={(e) => {
                const d = localDateFromInput(e.target.value)
                if (d) setCustomTo(d)
              }}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 sm:flex-none"
            />
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex-1 animate-pulse rounded-xl border border-slate-200 bg-white" />
      )}
      {error && <p className="text-red-600">{error.message}</p>}

      {!isLoading && !error && (
        <>
          <p className="mb-2 text-sm text-slate-500">
            Showing{' '}
            <span className="font-medium text-slate-700">
              {total === 0 ? 0 : pageStart + 1}–{pageStart + pageItems.length}
            </span>{' '}
            of <span className="font-medium text-slate-700">{total}</span> visits
          </p>

          <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-slate-500 shadow-sm">
                <tr>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Branch</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((r, i) => {
                  // A highlighted day-separator row whenever the local day changes
                  // (rows are newest-first). Keeps the "activity feed" feel.
                  const prev = i > 0 ? pageItems[i - 1] : undefined
                  const showDay =
                    !prev || !isSameLocalDay(new Date(prev.createdAt), new Date(r.createdAt))
                  return (
                    <ActivityRows
                      key={r.id}
                      row={r}
                      showDay={showDay}
                      dayCount={pageDayCounts.get(dayKey(r.createdAt)) ?? 0}
                    />
                  )
                })}
                {pageItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-16 text-center text-slate-400">
                      {search.trim() || branchFilter !== ALL
                        ? 'No check-ins match your filters in this range.'
                        : 'No check-ins in this range.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <Pagination
              page={page}
              pageCount={pageCount}
              canPrev={canPrev}
              canNext={canNext}
              onPage={setPage}
            />
          </div>
        </>
      )}
    </div>
  )
}

// A highlighted day-separator row (when the day changes) followed by the visit
// row. The separator is a sticky, branded band with the day's count so each date
// group is visually distinct as you scroll.
function ActivityRows({
  row: r,
  showDay,
  dayCount,
}: {
  row: CheckinReportRow
  showDay: boolean
  dayCount: number
}) {
  const initial = r.customerName.charAt(0).toUpperCase() || '?'
  return (
    <>
      {showDay && (
        <tr>
          <td colSpan={4} className="sticky top-11 z-[9] p-0">
            <div className="flex items-center gap-2 border-y border-brand-100 bg-brand-50 px-4 py-2">
              <span className="text-sm font-bold text-brand-800">
                {dayLabel(new Date(r.createdAt))}
              </span>
              <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
                {dayCount} {dayCount === 1 ? 'check-in' : 'check-ins'}
              </span>
            </div>
          </td>
        </tr>
      )}
      <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
        <td className="whitespace-nowrap px-4 py-3 text-slate-600 tabular-nums">
          {formatTime(r.createdAt)}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
              {initial}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {r.customerId ? (
                  <Link
                    to={`/admin/customers/${r.customerId}`}
                    className="font-medium text-slate-800 hover:text-brand-700 hover:underline"
                  >
                    {r.customerName}
                  </Link>
                ) : (
                  <span className="font-medium text-slate-800">{r.customerName}</span>
                )}
                {r.customerId &&
                  (() => {
                    const badge = tierBadge(customerTier(r.customerLifetimePoints))
                    return (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    )
                  })()}
              </div>
              {r.customerPhone && (
                <div className="text-xs text-slate-400">{formatPhone(r.customerPhone)}</div>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          {r.branchName ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              📍 {r.branchName}
            </span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          <StatusPill status={r.status} />
        </td>
      </tr>
    </>
  )
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === 'completed'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'in_service'
        ? 'bg-sky-100 text-sky-700'
        : status === 'cancelled'
          ? 'bg-slate-100 text-slate-500'
          : 'bg-amber-100 text-amber-700' // waiting
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>
  )
}

const BRANCH_ACCENTS = ['sky', 'violet', 'pink', 'amber'] as const
type Accent = 'brand' | 'slate' | (typeof BRANCH_ACCENTS)[number]

// A dashboard stat tile: big number, small label, a left accent bar for colour.
// Fixed height (h-16) so a value change or the loading skeleton never resizes it.
function StatTile({
  label,
  value,
  accent,
  loading = false,
}: {
  label: string
  value: number
  accent: Accent
  loading?: boolean
}) {
  const bar: Record<Accent, string> = {
    brand: 'bg-brand-500',
    slate: 'bg-slate-400',
    sky: 'bg-sky-500',
    violet: 'bg-violet-500',
    pink: 'bg-pink-500',
    amber: 'bg-amber-500',
  }
  return (
    <div className="flex h-16 items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className={`w-1.5 shrink-0 ${bar[accent]}`} />
      <div className="flex min-w-0 flex-col justify-center px-4">
        {loading ? (
          <div className="h-7 w-10 animate-pulse rounded bg-slate-200" />
        ) : (
          <div className="text-2xl font-bold tabular-nums leading-7 text-slate-800">{value}</div>
        )}
        <div className="truncate text-xs font-medium text-slate-500">{label}</div>
      </div>
    </div>
  )
}

// "Today" / "Yesterday" / weekday-date for a day-separator row.
function dayLabel(d: Date): string {
  const now = new Date()
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((start(now) - start(d)) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  })
}

// Time of day, e.g. "14:15".
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}
