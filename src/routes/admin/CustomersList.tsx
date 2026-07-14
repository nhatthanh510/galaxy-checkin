import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useCustomers,
  useDeleteCustomer,
  useLoyaltyProgram,
  useSettings,
  useCheckinCustomerIdsOnDate,
  useBranches,
  UNASSIGNED_BRANCH,
} from '../../lib/queries'
import { CSV_HEADERS, downloadCsv, toCsv } from '../../lib/csv'
import { formatDateTime, localDateFromInput, toDateInputValue } from '../../lib/day'
import { formatPhone } from '../../lib/phone'
import {
  birthdayStatus,
  birthdayStatusBadge,
  formatBirthday,
  formatBirthdayCsv,
} from '../../lib/birthday'
import { birthdayPercentForTier, customerTier, tierBadge } from '../../lib/tier'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { TextInput } from '../../components/ui/TextInput'
import { TableSkeleton } from '../../components/ui/Skeleton'
import type { Customer } from '../../types'
import {
  ELLIPSIS,
  pageNumbers,
  SORT_LABELS,
  type SortKey,
} from './customersListHelpers'
import { DateChip, NoteCell, TrashIcon } from './customersListParts'

export function CustomersList() {
  const { data: customers, isLoading, error } = useCustomers()
  const { data: program } = useLoyaltyProgram()
  const { data: settings } = useSettings()
  const deleteCustomer = useDeleteCustomer()
  const [search, setSearch] = useState('')
  const [eligibleOnly, setEligibleOnly] = useState(false)
  const [birthdayOnly, setBirthdayOnly] = useState(false)
  // Filter to customers who checked in on this local day; null = filter off.
  const [checkinDate, setCheckinDate] = useState<Date | null>(null)
  // Optionally scope the date filter to one branch. '' = all branches. Only
  // meaningful with a date chosen (branch belongs to a visit, so it's per-day).
  const [checkinBranchId, setCheckinBranchId] = useState<string>('')
  // Whether the "Custom" date picker is revealed (independent of a date being
  // chosen yet, so the picker can show before the user picks).
  const [customDateOpen, setCustomDateOpen] = useState(false)
  const [sortBy, setSortBy] = useState<SortKey>('lastVisit')
  const [page, setPage] = useState(0) // zero-based page index
  // Customer pending deletion (drives the confirmation dialog); null when closed.
  const [toDelete, setToDelete] = useState<Customer | null>(null)
  // Rows whose note is expanded to full text (tap-to-toggle, for touch devices
  // where the hover `title` tooltip doesn't work).
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())
  const toggleNote = (id: string) =>
    setExpandedNotes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // A customer is redeem-eligible (from admin) when their balance meets the
  // lowest active points-program threshold (>= N — a customer with exactly N
  // points can redeem an N-point reward, matching the kiosk and the redeem
  // control on the detail page). Null threshold => nobody eligible.
  const threshold = program?.pointsPerReward ?? null
  const isEligible = (points: number) => threshold != null && points >= threshold

  // Customer IDs that checked in on the selected date (only fetched when set),
  // optionally scoped to a branch.
  const { data: checkinIds, isFetching: checkinIdsLoading } =
    useCheckinCustomerIdsOnDate(checkinDate, checkinBranchId || null)
  const { data: branches } = useBranches(true)

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
      list = list.filter((c) => c.pointsBalance >= threshold)
    }
    if (birthdayOnly) {
      list = list.filter((c) => {
        const s = birthdayStatus(c.birthday, c.birthdayRedeemedYear, today, bdayBefore, bdayAfter)
        // Upcoming/today/recent birthdays, not the ones already claimed this year.
        return s !== 'none' && s !== 'claimed'
      })
    }
    // Checked-in-on-date: keep only customers whose id is in the day's set. While
    // the set is still loading, show nothing (avoids flashing the full list).
    if (checkinDate != null) {
      const ids = checkinIds
      list = ids ? list.filter((c) => ids.has(c.id)) : []
    }
    return list
    // `today` is a fresh Date each render but only its day matters; the window
    // settings (bdayBefore/After) are the values that actually change results.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, search, eligibleOnly, threshold, birthdayOnly, bdayBefore, bdayAfter, checkinDate, checkinIds])

  // Apply the chosen sort on top of the filtered list. The base query already
  // returns last-visited-first, but re-sorting here keeps it correct for the
  // other keys and after client-side filtering.
  const sorted = useMemo(() => {
    const list = [...filtered]
    const byName = (a: Customer, b: Customer) => a.name.localeCompare(b.name)
    switch (sortBy) {
      case 'points':
        return list.sort((a, b) => b.pointsBalance - a.pointsBalance || byName(a, b))
      case 'lifetime':
        return list.sort((a, b) => b.lifetimePoints - a.lifetimePoints || byName(a, b))
      case 'lastVisit':
      default:
        return list.sort((a, b) => {
          // Most recent first; never-visited (null) sort last.
          const ta = a.lastVisitAt ? Date.parse(a.lastVisitAt) : -Infinity
          const tb = b.lastVisitAt ? Date.parse(b.lastVisitAt) : -Infinity
          return tb - ta || byName(a, b)
        })
    }
  }, [filtered, sortBy])

  const eligibleCount = useMemo(
    () => (threshold == null ? 0 : (customers ?? []).filter((c) => c.pointsBalance >= threshold).length),
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

  // Client-side pagination over the filtered + sorted list.
  const PAGE_SIZE = 50
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  // Keep the page in range when the filter shrinks the list.
  const safePage = Math.min(page, pageCount - 1)
  const pageStart = safePage * PAGE_SIZE
  const paged = sorted.slice(pageStart, pageStart + PAGE_SIZE)

  const onExport = () => {
    const rows: (string | number)[][] = [
      [...CSV_HEADERS],
      ...(customers ?? []).map((c) => [
        c.phone,
        c.name,
        c.pointsBalance,
        c.visitCount,
        c.lifetimePoints,
        // Day-first "DD/MM" — never emit the stored sentinel year.
        formatBirthdayCsv(c.birthday),
        c.marketingConsent ? 1 : 0,
        c.lastVisitAt ?? '',
        c.notes,
      ]),
    ]
    downloadCsv('customers.csv', toCsv(rows))
  }

  const confirmDelete = () => {
    if (!toDelete) return
    deleteCustomer.mutate(toDelete.id, {
      onSuccess: () => setToDelete(null),
    })
  }

  // Date-filter helpers. The filter is one control with presets (Today /
  // Yesterday) plus a Custom picker; `checkinDate` holds the chosen local day.
  const isSameLocalDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  const dayOffset = (days: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d
  }
  const todayActive =
    !customDateOpen && checkinDate != null && isSameLocalDay(checkinDate, dayOffset(0))
  const yesterdayActive =
    !customDateOpen && checkinDate != null && isSameLocalDay(checkinDate, dayOffset(-1))
  // Set a preset day (or clear when the active one is tapped again). Clearing the
  // date also clears the branch (branch filtering is only meaningful per-day).
  const setPreset = (d: Date | null) => {
    setCustomDateOpen(false)
    setCheckinDate(d)
    if (d == null) setCheckinBranchId('')
    setPage(0)
  }
  // Enter/leave Custom mode; keep any already-chosen date so the picker seeds.
  const toggleCustom = () => {
    setCustomDateOpen((open) => {
      const next = !open
      if (!next) {
        setCheckinDate(null) // leaving Custom clears the filter
        setCheckinBranchId('') // and its branch scope
      }
      setPage(0)
      return next
    })
  }
  const setCustomDate = (d: Date | null) => {
    setCheckinDate(d)
    setPage(0)
  }
  const dateFilterActive = checkinDate != null

  // The active filters, as removable chips (label + how to clear it). Shown as a
  // row under the filter bar so it's obvious what's narrowing the list — easy to
  // forget a toggle is on and wonder where the customers went.
  const dateChipLabel = () => {
    if (checkinDate == null) return ''
    if (todayActive) return 'Checked in: Today'
    if (yesterdayActive) return 'Checked in: Yesterday'
    return `Checked in: ${checkinDate.toLocaleDateString()}`
  }
  const activeFilters: { key: string; label: string; clear: () => void }[] = [
    search.trim() && {
      key: 'search',
      label: `Search: "${search.trim()}"`,
      clear: () => {
        setSearch('')
        setPage(0)
      },
    },
    eligibleOnly && {
      key: 'eligible',
      label: 'Redeem-eligible',
      clear: () => {
        setEligibleOnly(false)
        setPage(0)
      },
    },
    birthdayOnly && {
      key: 'birthday',
      label: '🎂 Birthday nearby',
      clear: () => {
        setBirthdayOnly(false)
        setPage(0)
      },
    },
    dateFilterActive && {
      key: 'date',
      label: dateChipLabel(),
      clear: () => setPreset(null),
    },
    dateFilterActive &&
      checkinBranchId && {
        key: 'branch',
        label: `Branch: ${
          checkinBranchId === UNASSIGNED_BRANCH
            ? 'Unassigned'
            : ((branches ?? []).find((b) => b.id === checkinBranchId)?.name ?? 'Selected')
        }`,
        clear: () => {
          setCheckinBranchId('')
          setPage(0)
        },
      },
  ].filter((x): x is { key: string; label: string; clear: () => void } => Boolean(x))

  const clearAllFilters = () => {
    setSearch('')
    setEligibleOnly(false)
    setBirthdayOnly(false)
    setPreset(null) // also clears the branch scope
    setPage(0)
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
          <Button variant="secondary" onClick={onExport} disabled={!customers?.length}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Row 1: search (grows) + sort (right). Stacks on narrow widths. */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <TextInput
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
          placeholder="Search by name or phone…"
          className="w-full sm:max-w-md"
        />
        <div className="flex items-center gap-2 text-sm text-slate-600 sm:ml-auto">
          <span className="shrink-0">Sort by</span>
          <Select
            value={sortBy}
            aria-label="Sort customers by"
            options={(Object.keys(SORT_LABELS) as SortKey[]).map((k) => ({
              value: k,
              label: SORT_LABELS[k],
            }))}
            onChange={(k) => {
              setSortBy(k)
              setPage(0)
            }}
            className="w-44"
          />
        </div>
      </div>

      {/* Row 2: filters. Wrap as a unit so the layout stays tidy at any width. */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
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
            Redeem-eligible
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
          🎂 Birthday nearby
          <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-700">
            {birthdayCount}
          </span>
        </label>

        {/* Checked-in-on-date filter: a segmented control — Today / Yesterday /
            Custom. Custom reveals a date picker. The active chip shows how many
            customers checked in that day. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-slate-600">
          <span className="text-slate-500">Checked in:</span>
          {/* Keep the segmented control together (never split mid-way). */}
          <div className="inline-flex shrink-0 overflow-hidden rounded-lg border border-slate-300">
            <DateChip active={todayActive} onClick={() => setPreset(todayActive ? null : dayOffset(0))}>
              Today
            </DateChip>
            <DateChip
              active={yesterdayActive}
              onClick={() => setPreset(yesterdayActive ? null : dayOffset(-1))}
              bordered
            >
              Yesterday
            </DateChip>
            <DateChip active={customDateOpen} onClick={toggleCustom} bordered>
              Custom
            </DateChip>
          </div>
          {customDateOpen && (
            <input
              type="date"
              value={checkinDate ? toDateInputValue(checkinDate) : ''}
              onChange={(e) => setCustomDate(localDateFromInput(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 lg:w-auto"
            />
          )}
          {/* Branch scope — appears once a date is chosen (branch is per-visit,
              so it's inherently date-scoped). */}
          {dateFilterActive && (branches ?? []).length > 0 && (
            <Select
              value={checkinBranchId}
              aria-label="Filter by branch"
              placeholder="All branches"
              options={[
                { value: '', label: 'All branches' },
                ...(branches ?? []).map((b) => ({ value: b.id, label: b.name })),
                { value: UNASSIGNED_BRANCH, label: 'Unassigned' },
              ]}
              onChange={(v) => {
                setCheckinBranchId(v)
                setPage(0)
              }}
              className="w-full lg:w-40"
            />
          )}
          {dateFilterActive && (
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
              {checkinIdsLoading ? '…' : `${checkinIds?.size ?? 0} found`}
            </span>
          )}
        </div>
      </div>

      {/* Active-filter chips — one removable pill per active filter, so it's
          always clear what's narrowing the list. */}
      {activeFilters.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Filters
          </span>
          {activeFilters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={f.clear}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 py-1 pl-3 pr-2 text-sm font-medium text-brand-700 hover:bg-brand-200"
            >
              {f.label}
              <span className="text-brand-500" aria-hidden>
                ✕
              </span>
              <span className="sr-only">Remove filter</span>
            </button>
          ))}
          {activeFilters.length > 1 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {isLoading && <TableSkeleton cols={5} fill className="flex min-h-0 flex-1 flex-col" />}
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
                <th className="hidden px-4 py-3 font-medium lg:table-cell">DoB</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Last visited</th>
                <th className="px-4 py-3 font-medium">Points</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Lifetime points</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Notes</th>
                <th className="px-4 py-3 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.map((c) => {
                const eligible = isEligible(c.pointsBalance)
                const bday = bdayStatus(c.birthday, c.birthdayRedeemedYear)
                const badge = birthdayStatusBadge(bday)
                const bdayInWindow = bday === 'today' || bday === 'upcoming' || bday === 'recent'
                // Keep rows calm (mostly white) — status is a coloured LEFT ACCENT
                // bar, not a full-row wash. The one exception is a birthday TODAY,
                // which gets a light pink fill since it's genuinely act-now. Accent
                // colour matches the badge urgency (today→pink, soon→amber,
                // recent→blue; redeem-eligible→emerald).
                // Every row carries a 4px left border (transparent by default) so
                // accented and plain rows stay horizontally aligned — no content
                // shift between them.
                const rowAccent =
                  'border-l-4 ' +
                  (bday === 'today'
                    ? 'border-pink-500 bg-pink-50 hover:bg-pink-100'
                    : bday === 'upcoming'
                      ? 'border-amber-400 hover:bg-slate-50'
                      : bday === 'recent'
                        ? 'border-sky-400 hover:bg-slate-50'
                        : eligible
                          ? 'border-emerald-400 hover:bg-slate-50'
                          : 'border-transparent hover:bg-slate-50')
                const tBadge = tierBadge(customerTier(c.lifetimePoints))
                // The birthday discount this customer would get (tier-based),
                // shown beside the badge so staff see it at a glance. Only
                // meaningful while an unclaimed birthday is in-window.
                const bdayPct =
                  bdayInWindow && settings
                    ? birthdayPercentForTier(c.lifetimePoints, {
                        new: settings.birthdayPercentNew,
                        regular: settings.birthdayPercentRegular,
                        vip: settings.birthdayPercentVip,
                      })
                    : null
                return (
                  <tr
                    key={c.id}
                    className={'border-b border-slate-100 last:border-0 ' + rowAccent}
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
                      {/* Phone lives under the name at all widths (freed its own
                          column so Notes can show at lg+). */}
                      <div className="mt-1 text-xs text-slate-500">{formatPhone(c.phone)}</div>
                      {/* Below lg: DoB + notes also stack here (they have their
                          own columns at lg+). */}
                      <div className="mt-0.5 space-y-0.5 text-xs text-slate-500 lg:hidden">
                        <div className="flex flex-wrap items-center gap-1">
                          <span>🎂 {formatBirthday(c.birthday)}</span>
                          {badge && (
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          )}
                          {bdayPct != null && (
                            <span className="rounded-full bg-pink-100 px-1.5 py-0.5 text-[10px] font-semibold text-pink-700">
                              {bdayPct}% off
                            </span>
                          )}
                        </div>
                        <div className="text-slate-500">🕐 {formatDateTime(c.lastVisitAt)}</div>
                        {c.lastVisitBranchName && (
                          <div className="text-slate-500">📍 {c.lastVisitBranchName}</div>
                        )}
                        {c.notes.trim() !== '' && (
                          <NoteCell
                            notes={c.notes}
                            prefix="📝 "
                            expanded={expandedNotes.has(c.id)}
                            onToggle={() => toggleNote(c.id)}
                            className="text-slate-500"
                          />
                        )}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 align-top lg:table-cell">
                      {/* Date + badges on one line; whole chips (whitespace-nowrap)
                          wrap together only if the column gets tight. */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="whitespace-nowrap text-slate-600">
                          {formatBirthday(c.birthday)}
                        </span>
                        {badge && (
                          <span
                            className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        )}
                        {bdayPct != null && (
                          <span className="whitespace-nowrap rounded-full bg-pink-100 px-2 py-0.5 text-xs font-semibold text-pink-700">
                            {bdayPct}% off
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 align-top text-slate-600 lg:table-cell whitespace-nowrap">
                      <div>{formatDateTime(c.lastVisitAt)}</div>
                      {c.lastVisitBranchName && (
                        <div className="text-xs text-slate-400">📍 {c.lastVisitBranchName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {/* Desktop (lg+): balance + Redeemable chip on one line. */}
                      <div className="hidden items-center gap-2 lg:flex">
                        <span className="text-slate-600">{c.pointsBalance}</span>
                        {eligible && (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            🎁 Redeemable
                          </span>
                        )}
                      </div>
                      {/* Consolidated (below lg): current + lifetime, each labelled. */}
                      <div className="space-y-0.5 text-xs lg:hidden">
                        <div>
                          <span className="text-slate-400">Current </span>
                          <span className="text-slate-600">{c.pointsBalance}</span>
                        </div>
                        {eligible && (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                            🎁 Redeemable
                          </span>
                        )}
                        <div className="text-slate-600">
                          <span className="text-slate-400">Lifetime </span>
                          {c.lifetimePoints}
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 align-top text-slate-600 lg:table-cell">{c.lifetimePoints}</td>
                    <td className="hidden max-w-[16rem] px-4 py-3 align-top lg:table-cell">
                      {c.notes.trim() !== '' ? (
                        <NoteCell
                          notes={c.notes}
                          expanded={expandedNotes.has(c.id)}
                          onToggle={() => toggleNote(c.id)}
                          className="text-slate-600"
                        />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <button
                        onClick={() => setToDelete(c)}
                        title={`Delete ${c.name}`}
                        aria-label={`Delete ${c.name}`}
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <TrashIcon />
                      </button>
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

      <ConfirmDialog
        open={toDelete != null}
        title="Delete customer?"
        message={
          toDelete && (
            <>
              This permanently removes{' '}
              <span className="font-semibold text-slate-800">{toDelete.name}</span> (
              {formatPhone(toDelete.phone)}) along with their visit history and loyalty
              transactions. This cannot be undone.
            </>
          )
        }
        confirmLabel="Delete"
        danger
        busy={deleteCustomer.isPending}
        error={deleteCustomer.error?.message ?? null}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
