import { useMemo, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCustomers, useUpsertCustomers, type ImportCustomer } from '../../lib/queries'
import { CSV_HEADERS, parseCsv } from '../../lib/csv'
import { normalizePhone } from '../../lib/phone'
import { formatBirthday, partsToDateString } from '../../lib/birthday'
import { Button } from '../../components/ui/Button'

interface PreviewRow {
  row: ImportCustomer
  status: 'new' | 'update' | 'error'
  error?: string
  // Non-blocking notice (e.g. phone isn't a valid AU mobile). The row still
  // imports; the warning just flags it for staff to review afterwards.
  warning?: string
}

// Parse + validate CSV rows against the known header order, flagging each row as
// new / update (matched by phone) / error. A bad phone is a *warning*, not an
// error — the row still imports. The `customer.phone` column is only NOT NULL +
// UNIQUE (no length/format CHECK), so a non-standard phone is accepted; only the
// kiosk's create_checkin RPC enforces AU-mobile shape, which import doesn't use.
function buildPreview(text: string, existingPhones: Set<string>): PreviewRow[] {
  const rows = parseCsv(text)
  if (rows.length === 0) return []

  // Skip a header row if present (first cell equals the first header).
  const start = rows[0][0]?.trim().toLowerCase() === CSV_HEADERS[0] ? 1 : 0

  return rows.slice(start).map((cells): PreviewRow => {
    const [
      rawPhone = '',
      name = '',
      points = '0',
      visits = '0',
      lifetime = '',
      rawBirthday = '',
      rawConsent = '',
      rawLastVisited = '',
    ] = cells
    const phone = normalizePhone(rawPhone)

    // A phone is still required as the dedupe key, but it may be any non-empty
    // digit string. A non-standard one imports with a warning rather than being
    // skipped.
    if (phone.length === 0) {
      return {
        status: 'error',
        error: `Missing/invalid phone "${rawPhone}"`,
        row: { phone, name: name.trim(), pointsBalance: 0, visitCount: 0 },
      }
    }
    const phoneWarning =
      phone.length !== 10 || !phone.startsWith('04')
        ? `Phone "${rawPhone}" is not a valid AU mobile — review after import`
        : undefined
    if (!name.trim()) {
      return {
        status: 'error',
        error: 'Missing name',
        row: { phone, name: '', pointsBalance: 0, visitCount: 0 },
      }
    }

    const pointsBalance = Number(points)
    const visitCount = Number(visits)
    if (Number.isNaN(pointsBalance) || Number.isNaN(visitCount)) {
      return {
        status: 'error',
        error: 'Points/visits must be numbers',
        row: { phone, name: name.trim(), pointsBalance: 0, visitCount: 0 },
      }
    }

    // Optional trailing columns. Empty cells mean "leave column unset" (omitted
    // from the payload), not zero/null.
    let lifetimePoints: number | undefined
    if (lifetime.trim() !== '') {
      lifetimePoints = Number(lifetime)
      if (Number.isNaN(lifetimePoints)) {
        return {
          status: 'error',
          error: 'Lifetime points must be a number',
          row: { phone, name: name.trim(), pointsBalance, visitCount },
        }
      }
    }

    const birthday = parseBirthday(rawBirthday)
    if (birthday === INVALID) {
      return {
        status: 'error',
        error: `Invalid birthday "${rawBirthday}" (use DD/MM)`,
        row: { phone, name: name.trim(), pointsBalance, visitCount, lifetimePoints },
      }
    }

    const marketingConsent = parseConsent(rawConsent)

    const lastVisited = parseTimestamp(rawLastVisited)
    if (lastVisited === INVALID) {
      return {
        status: 'error',
        error: `Invalid last visited "${rawLastVisited}"`,
        row: { phone, name: name.trim(), pointsBalance, visitCount, lifetimePoints, birthday, marketingConsent },
      }
    }

    return {
      status: existingPhones.has(phone) ? 'update' : 'new',
      warning: phoneWarning,
      row: {
        phone,
        name: name.trim(),
        pointsBalance,
        visitCount,
        lifetimePoints,
        birthday,
        marketingConsent,
        lastVisited,
      },
    }
  })
}

// Sentinel: a cell was present but couldn't be parsed. `undefined` means
// "no column / empty cell" (leave untouched); a string is a valid value.
const INVALID = Symbol('invalid-cell')

// Accept an ISO 8601 timestamp (e.g. "2026-07-06T17:15:00"). Empty => undefined.
function parseTimestamp(raw: string): string | undefined | typeof INVALID {
  const s = raw.trim()
  if (s === '') return undefined
  const ms = Date.parse(s)
  if (Number.isNaN(ms)) return INVALID
  return new Date(ms).toISOString()
}

// Accept the AU day-first export format "DD/MM" (e.g. "06/07"), or legacy
// "YYYY-MM-DD" (old exports). Only day+month matter — normalized to the stored
// sentinel-year "2000-MM-DD". Empty => undefined; anything else => INVALID.
function parseBirthday(raw: string): string | null | undefined | typeof INVALID {
  const s = raw.trim()
  if (s === '') return undefined

  let day: number
  let month: number
  const ddmm = /^(\d{1,2})\/(\d{1,2})$/.exec(s)
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (ddmm) {
    day = Number(ddmm[1])
    month = Number(ddmm[2])
  } else if (iso) {
    month = Number(iso[2])
    day = Number(iso[3])
  } else {
    return INVALID
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return INVALID
  return partsToDateString({ day, month })
}

// Accept 1/0, true/false, yes/no (case-insensitive). Empty => undefined.
function parseConsent(raw: string): boolean | undefined {
  const s = raw.trim().toLowerCase()
  if (s === '') return undefined
  return s === '1' || s === 'true' || s === 'yes' || s === 'y'
}

export function CustomerImport() {
  const navigate = useNavigate()
  const { data: customers } = useCustomers()
  const upsert = useUpsertCustomers()
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [fileName, setFileName] = useState('')

  const existingPhones = useMemo(
    () => new Set((customers ?? []).map((c) => c.phone)),
    [customers],
  )

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const text = await file.text()
    setPreview(buildPreview(text, existingPhones))
  }

  const valid = (preview ?? []).filter((p) => p.status !== 'error')
  const errors = (preview ?? []).filter((p) => p.status === 'error')
  const newCount = valid.filter((p) => p.status === 'new').length
  const updateCount = valid.filter((p) => p.status === 'update').length
  const warnCount = valid.filter((p) => p.warning).length

  const onConfirm = async () => {
    await upsert.mutateAsync(valid.map((p) => p.row))
    navigate('/admin/customers')
  }

  return (
    <div className="max-w-4xl">
      <Link to="/admin/customers" className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to customers
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Import customers</h1>
      <p className="mt-1 text-sm text-slate-500">
        CSV columns: <code className="rounded bg-slate-200 px-1">{CSV_HEADERS.join(', ')}</code>.
        A header row is optional. Rows are matched to existing customers by phone.
      </p>

      <div className="mt-6">
        <label className="inline-block cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
          Choose CSV file
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
        </label>
        {fileName && <span className="ml-3 text-sm text-slate-500">{fileName}</span>}
      </div>

      {preview && (
        <>
          <div className="mt-6 flex gap-3 text-sm">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
              {newCount} new
            </span>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">
              {updateCount} update
            </span>
            {warnCount > 0 && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                {warnCount} warnings (imported)
              </span>
            )}
            {errors.length > 0 && (
              <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">
                {errors.length} errors (skipped)
              </span>
            )}
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Phone</th>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Points</th>
                  <th className="px-4 py-2 font-medium">Visits</th>
                  <th className="px-4 py-2 font-medium">Lifetime</th>
                  <th className="px-4 py-2 font-medium">Birthday</th>
                  <th className="px-4 py-2 font-medium">SMS</th>
                  <th className="px-4 py-2 font-medium">Last visited</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2">
                      <StatusBadge status={p.status} error={p.error} />
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      <span className={p.warning ? 'text-amber-700' : undefined} title={p.warning}>
                        {p.row.phone || '—'}
                      </span>
                      {p.warning && <span className="ml-1" title={p.warning}>⚠️</span>}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{p.row.name || '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{p.row.pointsBalance}</td>
                    <td className="px-4 py-2 text-slate-600">{p.row.visitCount}</td>
                    <td className="px-4 py-2 text-slate-600">{p.row.lifetimePoints ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{formatBirthday(p.row.birthday ?? null)}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {p.row.marketingConsent === undefined ? '—' : p.row.marketingConsent ? 'Yes' : 'No'}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {p.row.lastVisited ? new Date(p.row.lastVisited).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button onClick={onConfirm} disabled={valid.length === 0 || upsert.isPending}>
              {upsert.isPending ? 'Importing…' : `Import ${valid.length} rows`}
            </Button>
            {upsert.error && <span className="text-sm text-red-600">{upsert.error.message}</span>}
          </div>
        </>
      )}
    </div>
  )
}

function StatusBadge({ status, error }: { status: PreviewRow['status']; error?: string }) {
  if (status === 'error') {
    return <span className="text-red-600" title={error}>error: {error}</span>
  }
  if (status === 'update') {
    return <span className="text-blue-600">update</span>
  }
  return <span className="text-emerald-600">new</span>
}
