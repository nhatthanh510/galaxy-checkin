import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useTierChanges,
  useTierReviewPreview,
  useApplyTierReview,
  useSettings,
} from '../../lib/queries'
import { tierBadge, tierRank } from '../../lib/tier'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { TextInput } from '../../components/ui/TextInput'
import { TableSkeleton } from '../../components/ui/Skeleton'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import type { TierChange, TierReviewPreviewItem } from '../../types'

const PREVIEW_PAGE_SIZE = 100
// Applying at least this many at once asks for confirmation first (guards against
// an accidental mass downgrade).
const CONFIRM_THRESHOLD = 20

// The next automatic monthly review (cron '0 10 1 * *' = 1st of each month at
// 10:00 UTC). Computed client-side from that fixed schedule.
function nextMonthlyReview(now: Date): Date {
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 10, 0, 0))
  if (first.getTime() > now.getTime()) return first
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 10, 0, 0))
}

// Admin: the tier change audit log + on-demand review. Every tier movement (a
// monthly review decay, a check-in upgrade/recovery, or a manual set) is listed
// newest first. "Preview review" shows what a review WOULD change so the admin
// can filter/unselect before applying.
export function TierChanges() {
  const { data: changes, isLoading, error } = useTierChanges()
  const { data: settings } = useSettings()
  const preview = useTierReviewPreview()
  const apply = useApplyTierReview()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // A fresh preview selects everyone by default (set in the mutation's success
  // callback, not an effect, to avoid a cascading-render setState-in-effect).
  const runPreview = () =>
    preview.mutate(undefined, {
      onSuccess: (rows) => setSelected(new Set(rows.map((r) => r.customerId))),
    })

  const previewRows = preview.data
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  // Add/remove a batch (used by "select all" over the currently-filtered rows).
  const setMany = (ids: string[], checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)))
      return next
    })
  const onApply = (ids: string[]) =>
    apply.mutate(ids, { onSuccess: () => preview.reset() })

  // Decay is paused when both visit thresholds are 0 (every customer's activity
  // then "allows" their tier, so nothing is downgraded).
  const paused = settings != null && settings.tierVipMinVisits === 0 && settings.tierRegularMinVisits === 0
  const nextRun = nextMonthlyReview(new Date())

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tier changes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tier movements, newest first. A <TierWord>review</TierWord> is the monthly
            maintenance check (usually a downgrade for inactivity); a{' '}
            <TierWord>check-in</TierWord> is an upgrade or recovery earned by visiting; a{' '}
            <TierWord>manual</TierWord> change was set by an admin.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button onClick={runPreview} disabled={preview.isPending} className="whitespace-nowrap">
            {preview.isPending ? 'Checking…' : 'Preview review'}
          </Button>
          {apply.isSuccess && !previewRows && (
            <span className="text-sm font-medium text-emerald-600">
              ✓ {apply.data} customer{apply.data === 1 ? '' : 's'} adjusted
            </span>
          )}
          {preview.error && <span className="text-sm text-red-600">{preview.error.message}</span>}
          {apply.error && <span className="text-sm text-red-600">{apply.error.message}</span>}
        </div>
      </div>

      {/* Automatic-schedule status (times shown in the viewer's local timezone). */}
      {settings && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span aria-hidden className="text-base">
            🕒
          </span>
          <div className="text-sm">
            <span className="font-semibold text-slate-700">Automatic review</span>
            <span className="text-slate-500"> · monthly on the 1st · next </span>
            <span
              className="font-medium text-slate-700"
              title="Runs 10:00 UTC; shown in your local time"
            >
              {nextRun.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            {paused ? (
              <span
                className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200"
                title="Both visit thresholds are 0, so the monthly review runs but downgrades no one. Set them on the Settings page to activate decay."
              >
                ⏸ Decay paused (thresholds 0)
              </span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                ● Active · VIP {settings.tierVipMinVisits} / Regular {settings.tierRegularMinVisits}{' '}
                per {settings.tierWindowMonths} mo
              </span>
            )}
            <Link
              to="/admin/settings"
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 hover:underline"
              title={paused ? 'Enable automatic decay in Settings' : 'Adjust or disable automatic decay in Settings'}
            >
              <span aria-hidden>⚙️</span>
              {paused ? 'Enable' : 'Configure'}
            </Link>
          </div>
        </div>
      )}

      {previewRows && (
        <PreviewPanel
          rows={previewRows}
          selected={selected}
          onToggle={toggle}
          onSetMany={setMany}
          onApply={onApply}
          onCancel={() => preview.reset()}
          applying={apply.isPending}
          applyError={apply.error?.message ?? null}
        />
      )}

      <Card className="mt-6">
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : error ? (
          <p className="text-red-600">{error.message}</p>
        ) : !changes || changes.length === 0 ? (
          <p className="py-8 text-center text-slate-400">
            No tier changes yet. They appear here as the monthly review runs or customers
            check in — use “Preview review” to evaluate everyone now.
          </p>
        ) : (
          <AuditLog changes={changes} />
        )}
      </Card>
    </div>
  )
}

const LOG_PAGE_SIZE = 100
const SOURCE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'review', label: 'Review' },
  { key: 'checkin', label: 'Check-in' },
  { key: 'manual', label: 'Manual' },
] as const
type SourceFilter = (typeof SOURCE_FILTERS)[number]['key']

// The tier_change audit log with a source filter, a name search, and paging so
// it stays usable after a review that changed hundreds of customers.
function AuditLog({ changes }: { changes: TierChange[] }) {
  const [source, setSource] = useState<SourceFilter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const q = search.trim().toLowerCase()
  const filtered = changes.filter(
    (c) =>
      (source === 'all' || c.source === source) &&
      (q === '' || c.customerName.toLowerCase().includes(q) || c.customerPhone.includes(q)),
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / LOG_PAGE_SIZE))
  const clampedPage = Math.min(page, pageCount - 1)
  const pageRows = filtered.slice(clampedPage * LOG_PAGE_SIZE, clampedPage * LOG_PAGE_SIZE + LOG_PAGE_SIZE)

  const reset = () => setPage(0)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap gap-1">
          {SOURCE_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setSource(f.key)
                reset()
              }}
              className={
                'rounded-full px-3 py-1 text-xs font-medium ' +
                (source === f.key
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="w-full sm:ml-auto sm:w-56">
          <TextInput
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              reset()
            }}
            placeholder="Search name or phone"
            className="py-1.5"
          />
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Change</th>
              <th className="px-3 py-2 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((c) => (
              <ChangeRow key={c.id} change={c} />
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                  No changes match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
          <span>
            Page {clampedPage + 1} of {pageCount} · {filtered.length} change
            {filtered.length === 1 ? '' : 's'}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPage(clampedPage - 1)} disabled={clampedPage === 0}>
              Prev
            </Button>
            <Button
              variant="secondary"
              onClick={() => setPage(clampedPage + 1)}
              disabled={clampedPage >= pageCount - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function ChangeRow({ change }: { change: TierChange }) {
  const from = tierBadge(change.fromTier)
  const to = tierBadge(change.toTier)
  const isDowngrade = tierRank(change.toTier) < tierRank(change.fromTier)

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="whitespace-nowrap px-3 py-3 align-top text-slate-600">
        {new Date(change.createdAt).toLocaleString()}
      </td>
      <td className="px-3 py-3 align-top">
        <Link
          to={`/admin/customers/${change.customerId}`}
          className="font-medium text-brand-700 hover:underline"
        >
          {change.customerName}
        </Link>
      </td>
      <td className="whitespace-nowrap px-3 py-3 align-top">
        <span className="inline-flex items-center gap-1.5">
          <Badge badge={from} />
          <span className={isDowngrade ? 'text-amber-600' : 'text-emerald-600'}>
            {isDowngrade ? '↓' : '↑'}
          </span>
          <Badge badge={to} />
        </span>
      </td>
      <td className="px-3 py-3 align-top text-slate-600">
        {change.source === 'review'
          ? 'Monthly review'
          : change.source === 'manual'
            ? 'Manual (admin)'
            : 'Check-in'}
        {change.visitsInWindow != null && (
          <span className="text-slate-400">
            {' '}
            · {change.visitsInWindow} visit{change.visitsInWindow === 1 ? '' : 's'} in window
          </span>
        )}
      </td>
    </tr>
  )
}

function Badge({ badge }: { badge: { label: string; className: string } }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
      {badge.label}
    </span>
  )
}

function TierWord({ children }: { children: string }) {
  return <span className="font-medium text-slate-600">“{children}”</span>
}

// The dry-run preview: the changes a review would make, each with a checkbox so
// the admin can filter (e.g. to 0-visit customers) and unselect before applying.
// Locked customers never appear. Filtering + paging are local; selection is
// owned by the parent so Apply can act across pages.
function PreviewPanel({
  rows,
  selected,
  onToggle,
  onSetMany,
  onApply,
  onCancel,
  applying,
  applyError,
}: {
  rows: TierReviewPreviewItem[]
  selected: Set<string>
  onToggle: (id: string) => void
  onSetMany: (ids: string[], checked: boolean) => void
  onApply: (ids: string[]) => void
  onCancel: () => void
  applying: boolean
  applyError: string | null
}) {
  // Filter: show only rows with visits-in-window <= this (blank = all). Set to 0
  // to isolate customers with no visit in the window (definite lapses).
  const [maxVisits, setMaxVisits] = useState('')
  const [page, setPage] = useState(0)
  const [confirming, setConfirming] = useState(false)

  const cap = maxVisits.trim() === '' ? null : Math.max(0, Math.floor(Number(maxVisits) || 0))
  const filtered =
    cap == null ? rows : rows.filter((r) => (r.visitsInWindow ?? 0) <= cap)

  // Selection acts on the FILTERED set (across pages); Apply uses that.
  const filteredSelectedIds = filtered.filter((r) => selected.has(r.customerId)).map((r) => r.customerId)
  const allFilteredSelected = filtered.length > 0 && filteredSelectedIds.length === filtered.length

  const pageCount = Math.max(1, Math.ceil(filtered.length / PREVIEW_PAGE_SIZE))
  const clampedPage = Math.min(page, pageCount - 1)
  const pageRows = filtered.slice(
    clampedPage * PREVIEW_PAGE_SIZE,
    clampedPage * PREVIEW_PAGE_SIZE + PREVIEW_PAGE_SIZE,
  )

  const onFilterChange = (v: string) => {
    setMaxVisits(v)
    setPage(0)
  }

  if (rows.length === 0) {
    return (
      <Card className="mt-4 ring-1 ring-emerald-200">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            ✓ No changes — every unlocked customer’s tier is already up to date.
          </p>
          <Button variant="secondary" onClick={onCancel}>
            Close
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="mt-4 ring-1 ring-brand-200">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="text-lg font-semibold">
          Preview — {rows.length} customer{rows.length === 1 ? '' : 's'} would change
        </h2>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <label htmlFor="pv-max-visits" className="whitespace-nowrap">
            Max visits
          </label>
          <div className="w-20 shrink-0">
            <TextInput
              id="pv-max-visits"
              type="number"
              min={0}
              value={maxVisits}
              onChange={(e) => onFilterChange(e.target.value)}
              placeholder="all"
              className="py-1.5"
            />
          </div>
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Uncheck anyone you don’t want to change, then apply — one level each, same as the
        monthly review. Set “Max visits” to 0 to isolate customers with no visit in the window.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allFilteredSelected}
            onChange={() => onSetMany(filtered.map((r) => r.customerId), !allFilteredSelected)}
            className="h-4 w-4"
          />
          Select all {cap == null ? '' : 'shown '}({filtered.length})
        </label>
        <span className="text-slate-400">{filteredSelectedIds.length} selected</span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="w-8 px-3 py-2" />
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Change</th>
              <th className="px-3 py-2 font-medium">Visits in window</th>
              <th className="px-3 py-2 font-medium">Last visit</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => {
              const from = tierBadge(r.fromTier)
              const to = tierBadge(r.toTier)
              const isDown = tierRank(r.toTier) < tierRank(r.fromTier)
              return (
                <tr key={r.customerId} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-3 align-top">
                    <input
                      type="checkbox"
                      checked={selected.has(r.customerId)}
                      onChange={() => onToggle(r.customerId)}
                      className="h-4 w-4"
                      aria-label={`Include ${r.name}`}
                    />
                  </td>
                  <td className="px-3 py-3 align-top">
                    <Link
                      to={`/admin/customers/${r.customerId}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 align-top">
                    <span className="inline-flex items-center gap-1.5">
                      <Badge badge={from} />
                      <span className={isDown ? 'text-amber-600' : 'text-emerald-600'}>
                        {isDown ? '↓' : '↑'}
                      </span>
                      <Badge badge={to} />
                    </span>
                  </td>
                  <td className="px-3 py-3 align-top text-slate-600">{r.visitsInWindow ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-3 align-top text-slate-600">
                    {r.lastVisitAt ? new Date(r.lastVisitAt).toLocaleDateString() : 'Never'}
                  </td>
                </tr>
              )
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  No customers match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
          <span>
            Page {clampedPage + 1} of {pageCount} · {filtered.length} shown
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setPage(clampedPage - 1)}
              disabled={clampedPage === 0}
            >
              Prev
            </Button>
            <Button
              variant="secondary"
              onClick={() => setPage(clampedPage + 1)}
              disabled={clampedPage >= pageCount - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <Button
          onClick={() =>
            filteredSelectedIds.length >= CONFIRM_THRESHOLD
              ? setConfirming(true)
              : onApply(filteredSelectedIds)
          }
          disabled={applying || filteredSelectedIds.length === 0}
        >
          {applying
            ? 'Applying…'
            : `Apply ${filteredSelectedIds.length} change${filteredSelectedIds.length === 1 ? '' : 's'}`}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={applying}>
          Cancel
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Apply tier changes?"
        message={
          <>
            This updates <span className="font-semibold">{filteredSelectedIds.length}</span>{' '}
            customers one tier level each. It isn’t automatically reversible (you’d re-tier
            manually or wait for the next review).
          </>
        }
        confirmLabel={`Apply ${filteredSelectedIds.length}`}
        busy={applying}
        error={applyError}
        onConfirm={() => onApply(filteredSelectedIds)}
        onCancel={() => setConfirming(false)}
      />
    </Card>
  )
}
